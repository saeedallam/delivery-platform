export interface CreateOrderItemData {
  productId: string;
  quantity: number;
}

export interface CreateOrderData {
  userId: string;
  items: CreateOrderItemData[];
}
