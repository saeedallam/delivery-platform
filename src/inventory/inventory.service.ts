import { Injectable } from '@nestjs/common';
import { InsufficientStockError } from './errors/insufficient-stock.error';
import { InventoryNotFoundError } from './errors/inventory-not-found.error';
import { InventoryRepository } from './inventory.repository';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  interpretReservationResult(
    productId: string,
    requestedQuantity: number,
    reservationSucceeded: boolean,
    existingInventory: {
      quantity: number;
      reservedQuantity: number;
    } | null
  ): void {
    if (reservationSucceeded) {
      return;
    }

    if (!existingInventory) {
      throw new InventoryNotFoundError(productId);
    }

    const availableQuantity =
      existingInventory.quantity - existingInventory.reservedQuantity;

    throw new InsufficientStockError(
      productId,
      requestedQuantity,
      availableQuantity
    );
  }
}
