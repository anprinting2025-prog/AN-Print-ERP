import React, { useState } from 'react';
import {
  Plus,
  ShoppingBag,
  Factory,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { NavTab } from '../Sidebar.tsx';

interface MobileQuickActionFABProps {
  onNavigate: (tab: NavTab) => void;
  isSimulator?: boolean;
}

export const MobileQuickActionFAB: React.FC<MobileQuickActionFABProps> = ({
  onNavigate,
  isSimulator = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: 'New Order',
      icon: ShoppingBag,
      color: 'bg-indigo-600',
      tab: 'orders' as NavTab,
    },
    {
      label: 'Log Production',
      icon: Factory,
      color: 'bg-sky-600',
      tab: 'production' as NavTab,
    },
    {
      label: 'Record Payment',
      icon: CreditCard,
      color: 'bg-emerald-600',
      tab: 'payments' as NavTab,
    },
    {
      label: 'Record Expense',
      icon: Receipt,
      color: 'bg-amber-600',
      tab: 'expenses' as NavTab,
    },
  ];

  return (
    <div className={`fixed bottom-20 right-4 z-40 ${isSimulator ? 'block' : 'lg:hidden'}`}>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Action Items */}
      {isOpen && (
        <div className="relative mb-3 flex flex-col items-end space-y-2.5">
          {actions.map((act, i) => {
            const Icon = act.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-md border border-slate-100">
                  {act.label}
                </span>
                <button
                  onClick={() => {
                    onNavigate(act.tab);
                    setIsOpen(false);
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${act.color}`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Quick Actions"
        className={`flex h-13 w-13 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition-transform active:scale-90 ${
          isOpen ? 'rotate-45 bg-slate-900' : 'hover:scale-105'
        }`}
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>
    </div>
  );
};
