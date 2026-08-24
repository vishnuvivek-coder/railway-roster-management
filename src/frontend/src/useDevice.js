import { useState, useEffect } from 'react';

export function useDevice() {
  const [deviceMode, setDeviceMode] = useState(() => {
    try {
      return localStorage.getItem('railway_device_mode') || 'auto';
    } catch (e) {
      return 'auto';
    }
  });

  const [detectedPlatform, setDetectedPlatform] = useState('desktop');

  useEffect(() => {
    const detect = () => {
      const ua = navigator.userAgent || navigator.vendor || window.opera || '';
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

  const handleSetDeviceMode = (mode) => {
    setDeviceMode(mode);
    try {
      localStorage.setItem('railway_device_mode', mode);
    } catch (e) {}
  };

  const effectiveDevice = deviceMode === 'auto' ? detectedPlatform : deviceMode;

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
