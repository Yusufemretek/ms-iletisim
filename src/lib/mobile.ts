import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { navigate } from '@/lib/router';

let initialized = false;

/**
 * Native (Android/iOS) push bildirimleri Firebase gerektirir.
 * android/app/google-services.json eklenmeden PushNotifications.register()
 * çağrılırsa uygulama açılır açılmaz ÇÖKER ("FirebaseApp is not initialized").
 * Firebase kurulumunu yaptıktan sonra .env içine VITE_ENABLE_NATIVE_PUSH=true ekleyin.
 */
export const NATIVE_PUSH_ENABLED = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initMobile(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!isNative()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch { /* ignore */ }

  try {
    await SplashScreen.hide();
  } catch { /* ignore */ }

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      navigate('/');
    }
  });

  if (NATIVE_PUSH_ENABLED) {
    // Uygulama açılır açılmaz izin istemek yerine kısa bir gecikmeyle başlat
    setTimeout(() => { void initNativePush(); }, 1500);
  }
}

let pushListenersAdded = false;

async function initNativePush(): Promise<void> {
  try {
    if (!pushListenersAdded) {
      pushListenersAdded = true;
      await PushNotifications.addListener('registration', () => { /* token registered */ });
      await PushNotifications.addListener('registrationError', () => { /* ignore */ });
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = notification.title || '';
        const body = notification.body || '';
        if (title || body) {
          try { navigator.vibrate?.(200); } catch { /* ignore */ }
        }
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const data = event.notification.data || {};
        if (data.order_id) navigate(`/order/${data.order_id}`);
        else if (data.service_id) navigate('/teknik-servis');
        else if (data.trade_in_id) navigate('/trade-in-requests');
        else if (data.sell_phone_id) navigate('/sell-phone-requests');
      });
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();
  } catch { /* ignore */ }
}

export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* ignore */ }
}

export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* ignore */ }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* ignore */ }
}

export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  try { await Haptics.notification({ type: NotificationType.Error }); } catch { /* ignore */ }
}
