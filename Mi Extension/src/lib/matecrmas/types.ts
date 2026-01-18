
export interface ProductVariant {
  color: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  cost: number;
  price: number;
  priceX2?: number | null;
  priceMatias?: number | null;
  priceMatiasX2?: number | null;
  priceLosGurises?: number | null;
  priceLosGurisesX2?: number | null;
  quantity: number;
  variants?: ProductVariant[];
  isActive?: boolean;
  created_at: string;
}

export interface StockEntry {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface SaleItem {
  lineId: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  variant?: string;
}

export type SalesChannel = 'Correo Uruguayo' | 'Matías' | 'Mercado Libre' | 'Los Gurises';

export interface Sale {
  id: string;
  items: SaleItem[];
  discountPercentage: number;
  subtotal: number;
  total: number;
  createdAt: string;
  salesChannel: SalesChannel;
  shippingMethod?: string;
  shippingCost?: number;
  shippingQuantity?: number;
  // Campos de Facturación Biller
  billingStatus?: 'pending' | 'invoiced' | 'error';
  billerId?: string;
  invoiceUrl?: string;
  customerRnt?: string; // RUT o CI
  customerName?: string;
}

export type ExpenseCategory = 'Publicidad' | 'Costo de Envío' | 'Devolución' | 'Otro';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  createdAt: string;
}

export interface ProductFailure {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_cost: number;
  shipping_cost: number;
  quantity: number;
  variant?: string;
  reason: string;
  created_at: string;
}

export interface AdCostRecord {
  id: string;
  product_id: string;
  total_ad_cost: number;
  total_units_sold: number;
  cost_per_sale: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export type TransactionType = 'ingreso' | 'egreso';

export interface CashBoxTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  image_url?: string; 
  created_at: string;
}

export interface NatashaNote {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  audio_url?: string; 
  created_at: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  cost: number;
  created_at: string;
}

export type View = 'summary' | 'products' | 'sales' | 'expenses' | 'integrations' | 'notes' | 'calculator' | 'natasha' | 'shipping' | 'failures' | 'metrics' | 'billing';
