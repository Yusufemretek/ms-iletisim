import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { NATIVE_PUSH_ENABLED } from '@/lib/mobile';

const STORAGE_KEY = 'notif_permission_asked';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (Capacitor.isNativePlatform()) return NATIVE_PUSH_ENABLED ? 'granted' : 'unsupported';
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    if (!NATIVE_PUSH_ENABLED) return false;
    try {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch {
      return false;
    }
  }
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function shouldAskForPermission(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'default') return false;
  return sessionStorage.getItem(STORAGE_KEY) !== 'true';
}

export function markPermissionAsked(): void {
  sessionStorage.setItem(STORAGE_KEY, 'true');
}

export function showBrowserNotification(title: string, body: string, onClick?: () => void): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'ms-iletisim-' + Date.now(),
    });
    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
        notif.close();
      };
    }
    setTimeout(() => notif.close(), 8000);
  } catch {
    // Some browsers throw if the icon fails to load
  }
}

const SW_PATH = '/sw-push.js';

export function isPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return NATIVE_PUSH_ENABLED;
  return typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    return reg;
  } catch {
    return null;
  }
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'VAPID_PUBLIC_KEY')
      .maybeSingle();
    if (error || !data) return null;
    return data.value ?? null;
  } catch {
    return null;
  }
}

async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
  userId: string,
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const sub = subscription.toJSON();
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        is_active: true,
      }, { onConflict: 'user_id,endpoint' });

    return !error;
  } catch {
    return false;
  }
}

export async function setupPushNotifications(
  userId: string,
  _supabaseUrl?: string,
  _supabaseAnonKey?: string,
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    if (!NATIVE_PUSH_ENABLED) return false;
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return false;
      await PushNotifications.register();
      return true;
    } catch {
      return false;
    }
  }

  if (!isPushSupported()) return false;

  const permission = await requestNotificationPermission();
  if (!permission) return false;

  const registration = await registerPushServiceWorker();
  if (!registration) return false;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;

  // Unsubscribe any existing subscription first (handles VAPID key rotation)
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
  } catch {
    // ignore
  }

  return subscribeToPush(registration, vapidKey, userId);
}
