import { Injectable } from '@nestjs/common';
import { InsufficientStockError } from './errors/insufficient-stock.error';
import { InventoryNotFoundError } from './errors/inventory-not-found.error';
import { InventoryRepository } from './inventory.repository';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async reserveStock(productId: string, quantity: number) {
    const inventory = await this.inventoryRepository.reserveStock(
      productId,
      quantity
    );

    if (inventory) {
      return inventory;
    }

    const existingInventory =
      await this.inventoryRepository.findByProductId(productId);

    if (!existingInventory) {
      throw new InventoryNotFoundError(productId);
    }

    throw new InsufficientStockError(
      productId,
      quantity,
      existingInventory.quantity - existingInventory.reservedQuantity
    );
  }
}
