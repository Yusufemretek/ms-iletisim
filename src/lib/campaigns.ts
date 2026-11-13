import { supabase } from '@/lib/supabase';

export interface Campaign {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  scope_type: string;
  product_ids: string[] | null;
  category_ids: string[] | null;
}

let cachedCampaigns: Campaign[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export async function getActiveCampaigns(): Promise<Campaign[]> {
  if (cachedCampaigns && Date.now() - cacheTime < CACHE_TTL) return cachedCampaigns;
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('campaigns')
    .select('id, name, discount_type, discount_value, scope_type, product_ids, category_ids')
    .eq('is_active', true)
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gt.${now}`);
  // Sadece gerçekten indirim sağlayan kampanyalar ürün fırsatı sayılır
  cachedCampaigns = ((data as Campaign[]) || []).filter((c) => Number(c.discount_value) > 0);
  cacheTime = Date.now();
  return cachedCampaigns;
}

export function clearCampaignCache(): void {
  cachedCampaigns = null;
  cacheTime = 0;
}

export function getCampaignForProduct(
  productId: string,
  categoryId: string | null,
  campaigns: Campaign[],
): Campaign | null {
  if (!campaigns.length) return null;

  for (const c of campaigns) {
    if (c.scope_type === 'all') return c;
    if (c.scope_type === 'products' && c.product_ids?.includes(productId)) return c;
    if (c.scope_type === 'categories' && categoryId && c.category_ids?.includes(categoryId)) return c;
  }
  return null;
}

export function applyDiscount(originalPrice: number, campaign: Campaign): number {
  if (campaign.discount_type === 'percentage') {
    return Math.max(0, Math.round(originalPrice * (1 - campaign.discount_value / 100)));
  }
  return Math.max(0, originalPrice - campaign.discount_value);
}
