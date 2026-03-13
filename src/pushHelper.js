// src/pushHelper.js
import { Capacitor } from '@capacitor/core';

export async function getPushModule() {
  console.log('getPushModule loaded; Capacitor.isNativePlatform=', Capacitor.isNativePlatform());
  
  if (Capacitor.isNativePlatform()) {
    // dynamic import avoids bundling issue in web
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  }

  // web stub (so UI won't crash), mirrors minimal plugin API used in your code
  return {
    checkPermissions: async () => ({ receive: Notification.permission === 'granted' ? 'granted' : 'prompt' }),
    requestPermissions: async () => {
      if (typeof Notification !== 'undefined') {
        const perm = await Notification.requestPermission();
        return { receive: perm };
      }
      return { receive: 'denied' };
    },
    register: async () => { console.log('Push stub register'); },
    addListener: (_eventName, cb) => {
      console.log('Push stub: addListener', _eventName);
      return { remove: () => {} };
    }
  };
}