import { DeliveryStatus } from '../contracts/delivery-status.enum';

export interface Delivery {
  id: string;
  orderId: string;
  driverId: string | null;
  status: DeliveryStatus;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
