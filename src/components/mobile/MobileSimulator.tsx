import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  Wifi,
  BatteryCharging,
  Signal,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface MobileSimulatorProps {
  children: React.ReactNode;
  onClose: () => void;
}

type DeviceModel = 'iphone16' | 'galaxyS24' | 'posTerminal';

interface DeviceSpecs {
  name: string;
  width: number;
  height: number;
  rounded: string;
  bezel: string;
}

const DEVICES: Record<DeviceModel, DeviceSpecs> = {
  iphone16: {
    name: 'iPhone 16 Pro',
    width: 393,
    height: 844,
    rounded: 'rounded-[46px]',
    bezel: 'p-3 ring-12 ring-slate-800 shadow-2xl bg-slate-900',
  },
  galaxyS24: {
    name: 'Samsung Galaxy S24',
    width: 412,
    height: 880,
    rounded: 'rounded-[42px]',
    bezel: 'p-3 ring-10 ring-slate-800 shadow-2xl bg-slate-900',
  },
  posTerminal: {
    name: 'Workshop POS Terminal',
    width: 375,
    height: 760,
    rounded: 'rounded-[32px]',
    bezel: 'p-4 ring-12 ring-slate-900 shadow-2xl bg-slate-950',
  },
};

export const MobileSimulator: React.FC<MobileSimulatorProps> = ({ children, onClose }) => {
  const [deviceModel, setDeviceModel] = useState<DeviceModel>('iphone16');
  const [zoom, setZoom] = useState<number>(0.9);
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [algiersTime, setAlgiersTime] = useState<string>('12:00');

  // Clock updating in Africa/Algiers timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Algiers',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date());
        setAlgiersTime(timeStr);
      } catch {
        const now = new Date();
        setAlgiersTime(
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        );
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const currentDevice = DEVICES[deviceModel];
  const targetWidth = isLandscape ? currentDevice.height : currentDevice.width;
  const targetHeight = isLandscape ? currentDevice.width : currentDevice.height;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md">
      {/* Top Simulator Control Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                An Printing ERP — Mobile Simulator
              </span>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                PWA Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive mobile testing • Algeria Time ({algiersTime})
            </p>
          </div>
        </div>

        {/* Center Device Selector and Scale Controls */}
        <div className="flex items-center gap-2">
          {/* Device Model Selector */}
          <div className="flex items-center rounded-lg bg-slate-800 p-1 border border-slate-700 text-xs">
            {(Object.keys(DEVICES) as DeviceModel[]).map((key) => (
              <button
                key={key}
                onClick={() => setDeviceModel(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  deviceModel === key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {DEVICES[key].name}
              </button>
            ))}
          </div>

          {/* Orientation Toggle */}
          <button
            onClick={() => setIsLandscape(!isLandscape)}
            title="Toggle Orientation"
            className={`flex items-center gap-1 rounded-lg border border-slate-700 p-1.5 text-xs font-semibold transition ${
              isLandscape ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline">{isLandscape ? 'Landscape' : 'Portrait'}</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center rounded-lg bg-slate-800 p-1 border border-slate-700 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              disabled={zoom <= 0.7}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.1, z + 0.1))}
              disabled={zoom >= 1.1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Exit Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition shadow-xs"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Desktop</span>
          </button>
        </div>
      </header>

      {/* Simulator Viewport Area */}
      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
        {/* Device Outer Mockup Frame */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            width: `${targetWidth + 24}px`,
            height: `${targetHeight + 24}px`,
          }}
          className={`relative transition-all duration-300 shrink-0 ${currentDevice.bezel} ${currentDevice.rounded}`}
        >
          {/* Side hardware buttons */}
          <div className="absolute -left-4 top-24 h-10 w-1 rounded-l-sm bg-slate-700" />
          <div className="absolute -left-4 top-38 h-12 w-1 rounded-l-sm bg-slate-700" />
          <div className="absolute -left-4 top-54 h-12 w-1 rounded-l-sm bg-slate-700" />
          <div className="absolute -right-4 top-32 h-16 w-1 rounded-r-sm bg-slate-700" />

          {/* Screen Container */}
          <div
            style={{
              width: `${targetWidth}px`,
              height: `${targetHeight}px`,
            }}
            className={`relative flex flex-col overflow-hidden bg-slate-50 ${currentDevice.rounded} shadow-inner select-none`}
          >
            {/* Native Mobile Status Bar */}
            <div className="sticky top-0 z-50 flex h-10 w-full shrink-0 items-center justify-between bg-white/95 px-6 pt-1 backdrop-blur-md border-b border-slate-100 text-slate-900">
              {/* Algiers Local Time */}
              <span className="font-bold text-xs tracking-tight">{algiersTime}</span>

              {/* Dynamic Island / Camera Notch */}
              <div className="flex items-center justify-center">
                <div className="h-5 w-24 rounded-full bg-slate-950 flex items-center justify-end pr-2.5 shadow-xs">
                  <div className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
                </div>
              </div>

              {/* Status Icons: 5G, Wi-Fi, Battery */}
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-[10px] font-extrabold tracking-wider">5G</span>
                <Signal className="h-3 w-3 stroke-[2.5]" />
                <Wifi className="h-3 w-3 stroke-[2.5]" />
                <div className="flex items-center gap-0.5">
                  <BatteryCharging className="h-3.5 w-3.5 stroke-[2.5] text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Scrollable Mobile App Body */}
            <div className="relative flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>

            {/* Bottom Home Swipe Bar Indicator */}
            <div className="sticky bottom-0 z-50 flex h-5 w-full shrink-0 items-center justify-center bg-white/95 backdrop-blur-md">
              <div className="h-1 w-32 rounded-full bg-slate-900/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
