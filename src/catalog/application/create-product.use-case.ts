import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryRepository } from '../../inventory/inventory.repository';

import { Currency } from '../contracts/currency.enum';
import { ProductRepository } from '../product.repository';

export interface CreateProductInput {
  name: string;
  priceInMinorUnits: number;
  currency: Currency;
  initialQuantity: number;
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productRepository: ProductRepository,
    private readonly inventoryRepository: InventoryRepository
  ) {}

  async execute(input: CreateProductInput) {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.productRepository.create(
        {
          name: input.name,
          priceInMinorUnits: input.priceInMinorUnits,
          currency: input.currency,
        },
        tx
      );

      await this.inventoryRepository.create(
        product.id,
        input.initialQuantity,
        tx
      );

      return product;
    });
  }
}
