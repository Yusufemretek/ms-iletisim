import { Capacitor } from '@capacitor/core';
import { setupPushNotifications, isPushSupported } from '@/lib/notifications';

export async function registerPushNotifications(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  await setupPushNotifications(userId);
}

export async function unregisterPushNotifications(_userId: string): Promise<void> {
  if (!isPushSupported()) return;
  if (Capacitor.isNativePlatform()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch {
    // ignore
  }
}
