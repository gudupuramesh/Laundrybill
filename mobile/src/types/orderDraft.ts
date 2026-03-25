export interface DraftCustomer {
  id: string | null;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  isGuest: boolean;
}

export interface DraftOrderItem {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  basePrice: number;
  total: number;
  express: boolean;
  expressMultiplier: number;
  imageUrl?: string;
}

export interface DraftFinancials {
  subtotal: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  discountAmount: number;
  expressCharge: number;
  deliveryCharge: number;
  taxAmount: number;
  taxRate: number;
  taxName: string;
  total: number;
  amountPaid: number;
  balance: number;
}

export interface DraftOrderPayload {
  customer: DraftCustomer;
  items: DraftOrderItem[];
  financials: DraftFinancials;
}
