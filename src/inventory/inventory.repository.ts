import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProductId(productId: string) {
    return this.prisma.inventory.findUnique({
      where: { productId },
    });
  }

  async reserveStock(productId: string, quantity: number) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        productId: string;
        quantity: number;
        reservedQuantity: number;
        createdAt: Date;
        updatedAt: Date;
      }[]
    >`
      UPDATE "inventory"
      SET
        "reservedQuantity" = "reservedQuantity" + ${quantity},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "productId" = ${productId}
        AND "reservedQuantity" + ${quantity} <= "quantity"
      RETURNING
        "id",
        "productId",
        "quantity",
        "reservedQuantity",
        "createdAt",
        "updatedAt";
    `;

    return rows[0] ?? null;
  }
}
