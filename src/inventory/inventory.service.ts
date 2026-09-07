import { Injectable } from '@nestjs/common';
import { InsufficientStockError } from './errors/insufficient-stock.error';
import { InventoryNotFoundError } from './errors/inventory-not-found.error';
import { InventoryRepository } from './inventory.repository';
import { InventoryReleaseConflictError } from './errors/inventory-release-conflict.error';

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

  interpretReleaseResult(
    productId: string,
    requestedQuantity: number,
    releaseSucceeded: boolean,
    existingInventory: {
      reservedQuantity: number;
    } | null
  ): void {
    if (releaseSucceeded) {
      return;
    }

    if (!existingInventory) {
      throw new InventoryNotFoundError(productId);
    }

    throw new InventoryReleaseConflictError(
      productId,
      requestedQuantity,
      existingInventory.reservedQuantity
    );
  }
}
