import { Currency } from '../contracts/currency.enum';

export interface Product {
  id: string;
  name: string;
  priceInMinorUnits: number;
  currency: Currency;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
