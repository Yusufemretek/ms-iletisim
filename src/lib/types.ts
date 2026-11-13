export type ProductType = 'new_phone' | 'used_phone' | 'accessory' | 'tablet' | 'smartwatch';

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cash_on_delivery' | 'card_on_delivery' | 'cash' | 'card' | 'bank_transfer' | 'online_card';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export type SalesChannel = 'POS' | 'ONLINE' | 'KURYE' | 'GEL_AL' | 'SERVIS';
export type DeliveryType = 'GEL_AL' | 'KURYE';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

export type ServiceStatus =
  | 'RECEIVED'
  | 'QUOTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'PAID'
  | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_no: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  type: ProductType;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  cost_price: number;
  sale_price: number;
  stock: number;
  is_active: boolean;
  memory: string | null;
  ram: string | null;
  color: string | null;
  imei: string | null;
  battery_health: string | null;
  cosmetic_condition: string | null;
  screen_condition: string | null;
  face_id: string | null;
  touch_id: string | null;
  true_tone: string | null;
  camera_condition: string | null;
  speaker_condition: string | null;
  microphone_condition: string | null;
  warranty_status: string | null;
  warranty_end_date: string | null;
  warranty_start_date: string | null;
  box_condition: string | null;
  charger_condition: string | null;
  screen_size: string | null;
  camera_info: string | null;
  battery_capacity: string | null;
  processor: string | null;
  operating_system: string | null;
  installment_config: Record<string, { interest_rate: number; commission_rate: number }> | null;
  barcode: string | null;
  supplier_id: string | null;
  min_stock_level: number;
  condition_notes: string | null;
  replaced_parts: string | null;
  is_second_hand: boolean;
  pickup_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  position: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  storage: string;
  price: number;
  stock: number;
  sku: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithImages extends Product {
  slug?: string | null;
  category?: Category | null;
  product_images?: ProductImage[];
  product_variants?: ProductVariant[];
  suppliers?: Supplier | null;
}

export interface Address {
  id: string;
  user_id: string;
  title: string;
  city: string;
  district: string;
  neighborhood: string;
  street: string;
  building_no: string | null;
  apartment_no: string | null;
  directions: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  address_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  note: string | null;
  total: number;
  subtotal: number;
  discount: number;
  sales_channel: SalesChannel;
  delivery_type: DeliveryType;
  delivery_slot_id: string | null;
  assigned_courier_id: string | null;
  installment_count: number | null;
  installment_monthly_amount: number | null;
  installment_total: number | null;
  interest_amount: number;
  pos_commission_amount: number;
  net_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  product_snapshot: Record<string, unknown> | null;
  cost_price: number;
  discount: number;
  imei: string | null;
  image_url: string | null;
  variant?: { storage: string } | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  addresses?: Address | null;
}

export interface Sale {
  id: string;
  order_id: string;
  order_item_id: string;
  user_id: string | null;
  product_name: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
  total_sale: number;
  profit: number;
  payment_method: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  order_id: string | null;
  service_id: string | null;
  trade_in_id: string | null;
  sell_phone_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  variant_storage?: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  unit_price: number;
  quantity: number;
  stock: number;
  image_url: string | null;
  type: ProductType;
  imei: string | null;
  pickup_only?: boolean;
}

export interface DeliverySlot {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  order_id: string | null;
  source_type?: 'ORDER' | 'TRADE_IN' | 'SERVICE' | null;
  trade_in_id?: string | null;
  service_id?: string | null;
  customer_name?: string | null;
  title?: string | null;
  courier_id: string | null;
  delivery_type: string;
  status: DeliveryStatus;
  slot_id: string | null;
  scheduled_date: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  collected_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: string;
  amount: number;
  status: string;
  collected_by: string | null;
  collected_at: string | null;
  notes: string | null;
  installment_count: number | null;
  installment_monthly_amount: number | null;
  installment_total: number | null;
  interest_amount: number;
  pos_commission_amount: number;
  net_amount: number;
  transaction_id: string | null;
  payment_provider: string | null;
  masked_card: string | null;
  payment_status_detail: string | null;
  created_at: string;
}

export interface InstallmentSetting {
  id: number;
  installment_count: number;
  label: string;
  is_active: boolean;
  interest_rate: number;
  commission_rate: number;
  sort_order: number;
  updated_at: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  payment_type: string;
  created_at: string;
  created_by: string | null;
}

export interface ServiceRecord {
  id: string;
  service_number: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  device_brand: string | null;
  device_model: string | null;
  imei: string | null;
  issue_description: string | null;
  work_to_be_done: string | null;
  parts_cost: number;
  labor_cost: number;
  service_price: number;
  status: ServiceStatus;
  notes: string | null;
  pickup_requested: boolean;
  pickup_address: string | null;
  pickup_phone: string | null;
  pickup_date: string | null;
  pickup_slot_id: string | null;
  delivery_type: string | null;
  delivery_address: string | null;
  delivery_slot_id: string | null;
  quoted_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServicePart {
  id: string;
  service_id: string;
  part_name: string;
  cost_price: number;
  quantity: number;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  order_id: string | null;
  sale_id: string | null;
  user_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface DailyClosing {
  id: string;
  closing_date: string;
  cash_total: number;
  card_total: number;
  bank_total: number;
  total_sales: number;
  total_cost: number;
  gross_profit: number;
  pos_commission: number;
  expenses_total: number;
  net_profit: number;
  starting_cash: number;
  ending_cash: number;
  card_balance_before: number;
  card_transferred_to_bank: number;
  processed_by: string | null;
  created_at: string;
}

export interface ReturnRecord {
  id: string;
  order_id: string;
  return_number: string;
  reason: string | null;
  total_refund: number;
  status: string;
  processed_by: string | null;
  created_at: string;
}

export interface FinancialSummary {
  cash_balance: number;
  bank_balance: number;
  card_balance: number;
  today_sales: number;
  today_cost: number;
  today_profit: number;
  today_cash: number;
  today_card: number;
  today_bank: number;
  today_expenses: number;
  today_commission: number;
  net_profit: number;
  total_stock_value: number;
  low_stock_count: number;
  pending_orders: number;
  pending_services: number;
  courier_deliveries: number;
}

// KVKK & Legal types
export type LegalDocumentType = 'kvkk_notice' | 'explicit_consent' | 'commercial_communication' | 'privacy';

export interface LegalDocument {
  id: string;
  document_type: LegalDocumentType;
  title: string;
  content: string;
  version: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLegalAcknowledgement {
  id: string;
  user_id: string;
  document_id: string;
  document_version: string;
  acknowledged_at: string;
  source: string;
}

export type ConsentType = 'commercial_communication' | 'kvkk_notice' | 'explicit_consent';
export type ConsentChannel = 'sms' | 'email' | 'phone' | 'push';
export type ConsentStatus = 'granted' | 'revoked';

export interface ConsentLog {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  channel: ConsentChannel | null;
  status: ConsentStatus;
  document_version: string | null;
  source: string;
  created_at: string;
}

export type KvkkRequestSubject = 'info_request' | 'correction' | 'deletion' | 'preference_change' | 'other';
export type KvkkRequestStatus = 'pending' | 'in_review' | 'resolved' | 'rejected';

export interface KvkkRequest {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string;
  subject: KvkkRequestSubject;
  description: string | null;
  status: KvkkRequestStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Operator Campaign types
export type OperatorLeadStatus = 'new' | 'contacted' | 'waiting' | 'completed' | 'cancelled';
export type OperatorLeadRequestType =
  | 'number_portability'
  | 'new_line'
  | 'tariff_change'
  | 'campaign_info'
  | 'other';
export type OperatorEligibility =
  | 'new_line'
  | 'number_portability'
  | 'existing_customer'
  | 'youth'
  | 'prepaid'
  | 'postpaid';

export interface Operator {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  color: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OperatorCampaignCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface OperatorCampaign {
  id: string;
  operator_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  monthly_price: number | null;
  price_on_request: boolean;
  internet_gb: number | null;
  internet_unlimited: boolean;
  minutes: number | null;
  minutes_unlimited: boolean;
  sms: number | null;
  sms_unlimited: boolean;
  commitment_months: number | null;
  eligibility: string[];
  age_requirement: number | null;
  start_date: string;
  end_date: string | null;
  terms: string | null;
  featured: boolean;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  // joined fields
  operator?: Operator | null;
  category?: OperatorCampaignCategory | null;
  lead_count?: number;
}

export interface OperatorLead {
  id: string;
  campaign_id: string;
  operator_id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  current_operator: string | null;
  request_type: string;
  customer_note: string | null;
  admin_note: string | null;
  status: OperatorLeadStatus;
  created_at: string;
  updated_at: string;
  // joined fields
  campaign_name?: string;
  operator_name?: string;
  operator_color?: string;
}

export interface StoreSettings {
  id: number;
  store_name: string | null;
  store_subtitle: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  working_hours: string | null;
  whatsapp: string | null;
  courier_fee: number;
  pos_commission_rate: number;
  tax_rate: number;
  low_stock_threshold: number;
  loyalty_rate: number;
  min_order_amount: number;
  company_title: string | null;
  kvkk_email: string | null;
  company_address: string | null;
  created_at: string;
  updated_at: string;
}
