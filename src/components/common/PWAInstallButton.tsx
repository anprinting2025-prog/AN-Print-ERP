import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { Download, Smartphone, X, Share } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA on the home screen, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 rounded-lg bg-indigo-600 font-semibold text-white shadow-xs hover:bg-indigo-700 transition ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        }`}
        title="Install An Printing App on your phone or computer"
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100 transition ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="Install on iPhone / iPad"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    An
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Install on iPhone / iPad</h3>
                    <p className="text-[11px] text-slate-500">Run like a native iOS app</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    1
                  </span>
                  <span>
                    In Safari, tap the <strong>Share</strong> button <Share className="inline h-3.5 w-3.5 text-indigo-600 mb-0.5" /> at the bottom of the screen.
                  </span>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong> (+).
                  </span>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top right. An Printing will appear on your home screen!
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
