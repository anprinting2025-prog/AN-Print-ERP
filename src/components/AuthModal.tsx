import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Modal } from './common/Modal.tsx';
import {
  Printer,
  UserCheck,
  LogIn,
  UserPlus,
  Shield,
  KeyRound,
  Mail,
  Phone,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const {
    loginWithCredentials,
    submitSignupRequest,
    loginAsDemoOwner,
    profile,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isPendingApproval, setIsPendingApproval] = useState<boolean>(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Signup form state
  const [signupFullName, setSignupFullName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupRole, setSignupRole] = useState<'commerciale' | 'admin' | 'owner'>('commerciale');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupNotes, setSignupNotes] = useState<string>('');

  const resetForm = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsPendingApproval(false);
  };

  const handleSwitchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    resetForm();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsPendingApproval(false);
    setLoading(true);

    try {
      const res = await loginWithCredentials(loginEmail, loginPassword);
      if (!res.success) {
        if (res.isPending) {
          setIsPendingApproval(true);
        }
        setErrorMessage(res.error || 'Login failed. Please verify your credentials.');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await submitSignupRequest({
        fullName: signupFullName,
        email: signupEmail,
        phone: signupPhone,
        role: signupRole,
        password: signupPassword,
        notes: signupNotes,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit signup request');
      } else {
        setSuccessMessage(
          res.message ||
            'Signup request submitted successfully! Your account will be activated by the workshop admin.'
        );
        // Pre-fill login email
        setLoginEmail(signupEmail);
        setLoginPassword(signupPassword);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit registration request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="md"
    >
      <div className="p-1 space-y-5">
        {/* Header branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md mx-auto">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              An Printing ERP Portal
            </h2>
            <p className="text-xs text-slate-500">
              Algiers Workshop Management • Bags Printing & Packaging
            </p>
          </div>
        </div>

        {/* Tab switchers: Sign In vs First-Time Request */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Staff Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('signup')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              mode === 'signup'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>First Time? Sign Up Request</span>
          </button>
        </div>

        {/* Alerts / Feedback */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
              {isPendingApproval && (
                <p className="mt-1 text-[11px] text-rose-700">
                  Tip: Ask the workshop owner to open <strong>Settings &gt; Team Credentials</strong> and click <strong>Approve &amp; Activate</strong>.
                </p>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-900">Request Received Successfully!</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">{successMessage}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-200 flex justify-end">
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-2xs"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Mode 1: Login Form */}
        {mode === 'login' && !successMessage && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="e.g. amine@anprinting.dz"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Enter your credential password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Log In to Workspace</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Mode 2: First-time Signup / Access Request Form */}
        {mode === 'signup' && !successMessage && (
          <form onSubmit={handleSignupSubmit} className="space-y-3">
            <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-2.5 text-[11px] text-indigo-900">
              <span className="font-bold">New team member?</span> Fill this form once to register your profile. The admin will review and activate your access permissions or adjust your role.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yassine Cherif"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="yassine@anprinting.dz"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="0550 00 11 22"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rôle Souhaité / Role Requested
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 bg-white font-bold"
                >
                  <option value="commerciale">💼 Commerciale (Ventes &amp; Commandes)</option>
                  <option value="admin">🛡️ Admin (Gestionnaire d'Atelier)</option>
                  <option value="owner">👑 Copropriétaire / Associé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password to Access Your Account *
              </label>
              <input
                type="password"
                required
                placeholder="Choose a password you will remember"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Workshop Station / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Printing line 2, Bag counting, Delivery agent..."
                value={signupNotes}
                onChange={(e) => setSignupNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Submitting Request...</span>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Submit Signup Request for Approval</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Demo Access Divider */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Need instant administrative testing?</span>
            <button
              type="button"
              onClick={loginAsDemoOwner}
              className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Owner Quick Access (Demo)</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
