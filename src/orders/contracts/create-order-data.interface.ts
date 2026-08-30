export interface CreateOrderItemData {
  productId: string;
  quantity: number;
  unitPriceInMinorUnits: number;
}

export interface CreateOrderData {
  userId: string;
  currency: string;
  items: CreateOrderItemData[];
}
