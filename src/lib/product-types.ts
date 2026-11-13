import type { ProductType } from '@/lib/types';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  new_phone: 'Sıfır Telefon',
  used_phone: '2. El Telefon',
  accessory: 'Aksesuar',
  tablet: 'Tablet',
  smartwatch: 'Akıllı Saat',
};

export const PRODUCT_TYPE_BADGE_VARIANT: Record<ProductType, 'success' | 'info' | 'default' | 'warning'> = {
  new_phone: 'success',
  used_phone: 'info',
  accessory: 'default',
  tablet: 'warning',
  smartwatch: 'warning',
};

export function getProductTypeLabel(type: ProductType): string {
  return PRODUCT_TYPE_LABELS[type] || type;
}

export function getProductTypeBadgeVariant(type: ProductType): 'success' | 'info' | 'default' | 'warning' {
  return PRODUCT_TYPE_BADGE_VARIANT[type] || 'default';
}
