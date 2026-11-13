import type { OrderStatus, SalesChannel, DeliveryType, DeliveryStatus, ServiceStatus } from './types';

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Yeni Sipariş',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipping: 'Teslimata Çıktı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_on_delivery: 'Kapıda Nakit',
  card_on_delivery: 'Kapıda Kart',
  cash: 'Nakit',
  card: 'Kart',
  bank_transfer: 'Havale/EFT',
  havale: 'Havale/EFT',
  online_card: 'Online Kart',
};

export function paymentMethodLabel(method: string, deliveryType: DeliveryType): string {
  if (deliveryType === 'GEL_AL') {
    if (method === 'cash_on_delivery') return 'Nakit';
    if (method === 'card_on_delivery') return 'Kart';
  }
  return PAYMENT_METHOD_LABELS[method] || method;
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Ödeme Bekleniyor',
  partial: 'Kısmi Ödeme',
  paid: 'Ödendi',
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  POS: 'POS',
  ONLINE: 'Online',
  KURYE: 'Kurye',
  GEL_AL: 'Gel-Al',
  SERVIS: 'Servis',
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  GEL_AL: 'Mağazadan Teslim Al',
  KURYE: 'Kurye Teslimat',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: 'Kurye Bekliyor',
  ASSIGNED: 'Kurye Atandı',
  PICKED_UP: 'Teslim Alındı',
  OUT_FOR_DELIVERY: 'Dağıtımda',
  DELIVERED: 'Teslim Edildi',
  FAILED: 'Teslim Edilemedi',
  RETURNED: 'İade Edildi',
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  RECEIVED: 'Kayıt Alındı',
  QUOTED: 'Fiyat Teklifi Gönderildi',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  IN_PROGRESS: 'İşlem Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  DELIVERED: 'Teslim Edildi',
  PAID: 'Tahsil Edildi',
  CANCELLED: 'İptal Edildi',
};

export const TRADE_IN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
};

export const SELL_PHONE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  QUOTED: 'Fiyat Teklifi Gönderildi',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
};

export const OPERATOR_LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Yeni',
  contacted: 'İletişime Geçildi',
  waiting: 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export function statusLabel(type: string, status: string): string {
  const maps: Record<string, Record<string, string>> = {
    service: SERVICE_STATUS_LABELS,
    order: ORDER_STATUS_LABELS,
    trade_in: TRADE_IN_STATUS_LABELS,
    sell_phone: SELL_PHONE_STATUS_LABELS,
    operator_lead: OPERATOR_LEAD_STATUS_LABELS,
    delivery: DELIVERY_STATUS_LABELS,
  };
  return maps[type]?.[status] || status;
}

export const COSMETIC_OPTIONS = [
  'Sıfır Ayarında',
  'Çok Temiz',
  'Temiz',
  'Orta',
  'Kullanılmış',
];

export const STATUS_YES_NO = ['Aktif', 'Arızalı', 'Yok'];

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'shipping',
  'delivered',
];

export const SERVICE_STATUS_FLOW: ServiceStatus[] = [
  'RECEIVED',
  'QUOTED',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'DELIVERED',
  'PAID',
];

export const EXPENSE_CATEGORIES = [
  'Kira',
  'Elektrik',
  'Su',
  'İnternet',
  'Personel Maaşı',
  'Vergi',
  'Reklam',
  'POS Komisyonu',
  'Kırtasiye',
  'Bakım',
  'Diğer',
];
