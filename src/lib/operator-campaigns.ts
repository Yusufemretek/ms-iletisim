import type { OperatorCampaign, OperatorLeadStatus } from './types';

export const LEAD_STATUS_LABELS: Record<OperatorLeadStatus, string> = {
  new: 'Yeni',
  contacted: 'İletişime Geçildi',
  waiting: 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

export const LEAD_STATUS_VARIANTS: Record<OperatorLeadStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'amber'> = {
  new: 'info',
  contacted: 'amber',
  waiting: 'warning',
  completed: 'success',
  cancelled: 'error',
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  number_portability: 'Numara Taşıma',
  new_line: 'Yeni Hat',
  tariff_change: 'Tarife Değişikliği',
  campaign_info: 'Kampanya Hakkında Bilgi',
  other: 'Diğer',
};

export const ELIGIBILITY_LABELS: Record<string, string> = {
  new_line: 'Yeni Hat',
  number_portability: 'Numara Taşıma',
  existing_customer: 'Mevcut Müşteri',
  youth: 'Genç',
  prepaid: 'Faturasız',
  postpaid: 'Faturalı',
};

export function formatInternet(campaign: OperatorCampaign): string {
  if (campaign.internet_unlimited) return 'Sınırsız';
  if (campaign.internet_gb != null) return `${campaign.internet_gb} GB`;
  return '-';
}

export function formatMinutes(campaign: OperatorCampaign): string {
  if (campaign.minutes_unlimited) return 'Sınırsız';
  if (campaign.minutes != null) return `${campaign.minutes} DK`;
  return '-';
}

export function formatSms(campaign: OperatorCampaign): string {
  if (campaign.sms_unlimited) return 'Sınırsız';
  if (campaign.sms != null) return `${campaign.sms} SMS`;
  return '-';
}

export function formatCommitment(months: number | null): string {
  if (months == null) return 'Belirtilmemiş';
  if (months === 0) return 'Taahhütsüz';
  return `${months} Ay`;
}

export function formatPriceOrRequest(campaign: OperatorCampaign): string {
  if (campaign.price_on_request) return 'Fiyat için bilgi alın';
  if (campaign.monthly_price != null) return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(campaign.monthly_price)} ₺ / Ay`;
  return 'Detaylı bilgi için iletişime geçin';
}

export function isCampaignExpired(campaign: OperatorCampaign): boolean {
  if (!campaign.end_date) return false;
  return new Date(campaign.end_date) < new Date(new Date().toDateString());
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
