import { useState, useEffect } from 'react';

export type DevicePlatform = 'ios' | 'android' | 'desktop';
export type DeviceMode = 'auto' | DevicePlatform;

export interface UseDeviceReturn {
  device: DevicePlatform;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
  detectedPlatform: DevicePlatform;
}

export function useDevice(): UseDeviceReturn {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>(() => {
    try {
      const saved = localStorage.getItem('railway_device_mode');
      if (saved === 'ios' || saved === 'android' || saved === 'desktop') return saved;
      return 'auto';
    } catch (e) {
      return 'auto';
    }
  });

  const [detectedPlatform, setDetectedPlatform] = useState<DevicePlatform>('desktop');

  useEffect(() => {
    const detect = () => {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      const isIOSPlatform = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroidPlatform = /Android/i.test(ua);
      const isSmallScreen = window.innerWidth <= 768;

      if (isIOSPlatform) {
        setDetectedPlatform('ios');
      } else if (isAndroidPlatform) {
        setDetectedPlatform('android');
      } else if (isSmallScreen) {
        setDetectedPlatform('android'); // Default mobile styling for other mobile browsers
      } else {
        setDetectedPlatform('desktop');
      }
    };

    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, []);

  const handleSetDeviceMode = (mode: DeviceMode) => {
    setDeviceMode(mode);
    try {
      localStorage.setItem('railway_device_mode', mode);
    } catch (e) {}
  };

  const effectiveDevice: DevicePlatform = deviceMode === 'auto' ? detectedPlatform : deviceMode;

  return {
    device: effectiveDevice,
    isIOS: effectiveDevice === 'ios',
    isAndroid: effectiveDevice === 'android',
    isDesktop: effectiveDevice === 'desktop',
    isMobile: effectiveDevice === 'ios' || effectiveDevice === 'android',
    deviceMode,
    setDeviceMode: handleSetDeviceMode,
    detectedPlatform
  };
}
