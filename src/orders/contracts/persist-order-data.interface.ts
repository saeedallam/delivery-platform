import { CreateOrderItemData } from './create-order-data.interface';

export interface PersistOrderData {
  userId: string;
  currency: string;
  totalAmountInMinorUnits: number;
  items: CreateOrderItemData[];
}
