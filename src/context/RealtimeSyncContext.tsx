import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { api } from '../services/api.ts';
import { UserProfile, UserRole } from '../types/erp.ts';

interface RealtimeSyncContextType {
  isLiveConnected: boolean;
  lastSyncTimestamp: number;
  pendingRequests: UserProfile[];
  pendingCount: number;
  isJoinRequestsModalOpen: boolean;
  setIsJoinRequestsModalOpen: (open: boolean) => void;
  latestRequestNotification: UserProfile | null;
  dismissNotification: () => void;
  approveRequest: (user: UserProfile, options?: { role?: UserRole; permissions?: string[] }) => Promise<boolean>;
  rejectRequest: (user: UserProfile) => Promise<boolean>;
  refreshPendingRequests: () => Promise<void>;
  forceSyncAll: () => Promise<void>;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextType | undefined>(undefined);

export const RealtimeSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, token } = useAuth();
  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(Date.now());
  const [pendingRequests, setPendingRequests] = useState<UserProfile[]>([]);
  const [isJoinRequestsModalOpen, setIsJoinRequestsModalOpen] = useState<boolean>(false);
  const [latestRequestNotification, setLatestRequestNotification] = useState<UserProfile | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const lastSyncTimestampRef = useRef<number>(Date.now());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Sound chime helper (using Web Audio API, zero external files)
  const playNotificationChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio autoplay may be constrained by browser policy until user interacts
    }
  }, []);

  // Fetch pending team join requests (Owner or Admin)
  const refreshPendingRequests = useCallback(async () => {
    if (!token || !isOwnerOrAdmin) return;
    try {
      const data = await api.getPendingTeam(token);
      setPendingRequests(data || []);
    } catch (err) {
      console.warn('Failed to load pending requests:', err);
    }
  }, [token, isOwnerOrAdmin]);

  // Initial load of pending requests
  useEffect(() => {
    if (isOwnerOrAdmin && token) {
      refreshPendingRequests();
    }
  }, [isOwnerOrAdmin, token, refreshPendingRequests]);

  // Trigger global data refresh
  const triggerLocalSync = useCallback((entity?: string, data?: any) => {
    const now = Date.now();
    lastSyncTimestampRef.current = now;
    setLastSyncTimestamp(now);

    window.dispatchEvent(
      new CustomEvent('an_erp_sync', {
        detail: { entity, data, timestamp: now },
      })
    );

    if (entity) {
      window.dispatchEvent(
        new CustomEvent(`an_${entity}_sync`, {
          detail: { data, timestamp: now },
        })
      );
    }
  }, []);

  // Approve a pending join request
  const approveRequest = async (
    user: UserProfile,
    customOptions?: { role?: UserRole; permissions?: string[] }
  ): Promise<boolean> => {
    if (!token) return false;
    try {
      const assignedRole = customOptions?.role || user.role || 'commerciale';
      const assignedPerms = customOptions?.permissions || (assignedRole === 'owner' || assignedRole === 'admin'
        ? ['orders', 'inventory', 'purchases', 'customers', 'inactive_clients', 'production', 'suppliers', 'payments', 'expenses', 'reports', 'settings']
        : ['orders', 'customers', 'inactive_clients']);

      await api.approveTeamMember(user.id, { role: assignedRole, permissions: assignedPerms, isActive: true }, token);
      await refreshPendingRequests();
      triggerLocalSync('team');

      // Also broadcast via BroadcastChannel
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'TEAM_UPDATED', userId: user.id });
      }
      return true;
    } catch (err: any) {
      console.error('Error approving user:', err);
      alert(err.message || 'Erreur lors de l’approbation de la demande.');
      return false;
    }
  };

  // Reject / delete a pending join request
  const rejectRequest = async (user: UserProfile): Promise<boolean> => {
    if (!token) return false;
    if (!confirm(`Refuser la demande de ${user.fullName} (${user.email}) ?`)) return false;
    try {
      await api.deleteTeamMember(user.id, token);
      await refreshPendingRequests();
      triggerLocalSync('team');

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'TEAM_UPDATED', userId: user.id });
      }
      return true;
    } catch (err: any) {
      console.error('Error rejecting user:', err);
      alert(err.message || 'Erreur lors du refus de la demande.');
      return false;
    }
  };

  const forceSyncAll = async () => {
    triggerLocalSync('all');
    if (isOwner) {
      await refreshPendingRequests();
    }
  };

  const dismissNotification = () => {
    setLatestRequestNotification(null);
  };

  // Setup Server-Sent Events (SSE) live connection
  useEffect(() => {
    // Cross-tab BroadcastChannel
    try {
      broadcastChannelRef.current = new BroadcastChannel('an_printing_db_sync');
      broadcastChannelRef.current.onmessage = (ev) => {
        if (ev.data?.type === 'DB_MUTATION' || ev.data?.type === 'TEAM_UPDATED') {
          triggerLocalSync(ev.data?.entity, ev.data);
          if (isOwner) refreshPendingRequests();
        }
      };
    } catch {
      // BroadcastChannel unsupported fallback
    }

    let isUnmounted = false;

    const connectSSE = () => {
      if (isUnmounted) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        const es = new EventSource('/api/sync/events');
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isUnmounted) setIsLiveConnected(true);
        };

        es.onmessage = (event) => {
          if (isUnmounted || !event.data) return;
          try {
            const payload = JSON.parse(event.data);

            if (payload.type === 'CONNECTED') {
              setIsLiveConnected(true);
              if (payload.lastModified && payload.lastModified > lastSyncTimestampRef.current) {
                triggerLocalSync('general', payload);
              }
            } else if (payload.type === 'NEW_COMMERCIAL_REQUEST') {
              // A new person submitted a request from their phone / computer!
              triggerLocalSync('team', payload.data);
              if (isOwner) {
                refreshPendingRequests();
                playNotificationChime();
                setLatestRequestNotification({
                  id: payload.data?.id || `user-${Date.now()}`,
                  email: payload.data?.email || '',
                  fullName: payload.data?.fullName || 'Nouveau Commercial',
                  role: 'commerciale',
                  phone: payload.data?.phone || '',
                  notes: payload.data?.notes || '',
                  isActive: false,
                  createdAt: new Date().toISOString(),
                });
              }
            } else if (payload.type === 'TEAM_UPDATED') {
              triggerLocalSync('team', payload.data);
              if (isOwner) refreshPendingRequests();
            } else if (payload.type === 'DB_MUTATION') {
              // Real-time synchronization like Google Sheets!
              triggerLocalSync(payload.entity, payload.data);
              if (payload.entity === 'auth' || payload.entity === 'team') {
                if (isOwner) refreshPendingRequests();
              }
            }
          } catch {
            // Ignore non-json comments or heartbeat
          }
        };

        es.onerror = () => {
          if (!isUnmounted) {
            setIsLiveConnected(false);
            es.close();
            // Reconnect after 3s
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(connectSSE, 3000);
          }
        };
      } catch (e) {
        setIsLiveConnected(false);
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectSSE, 4000);
      }
    };

    connectSSE();

    // Fast Polling Fallback (every 3 seconds) to guarantee sync even if SSE reconnects
    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getSyncStatus();
        if (status.lastModified > lastSyncTimestampRef.current) {
          triggerLocalSync('poll_update');
          if (isOwner) refreshPendingRequests();
        }
      } catch {
        // Silently tolerate background network latency
      }
    }, 3000);

    // Focus & Visibility listener: sync instantly when tab is opened/unhidden
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerLocalSync('visibility');
        if (isOwner) refreshPendingRequests();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      isUnmounted = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [isOwner, refreshPendingRequests, triggerLocalSync, playNotificationChime]);

  return (
    <RealtimeSyncContext.Provider
      value={{
        isLiveConnected,
        lastSyncTimestamp,
        pendingRequests,
        pendingCount: pendingRequests.length,
        isJoinRequestsModalOpen,
        setIsJoinRequestsModalOpen,
        latestRequestNotification,
        dismissNotification,
        approveRequest,
        rejectRequest,
        refreshPendingRequests,
        forceSyncAll,
      }}
    >
      {children}
    </RealtimeSyncContext.Provider>
  );
};

export const useRealtimeSync = () => {
  const context = useContext(RealtimeSyncContext);
  if (!context) {
    throw new Error('useRealtimeSync must be used within a RealtimeSyncProvider');
  }
  return context;
};
