import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductData } from './contracts/create-product-data.interface';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return await this.prisma.product.findUnique({ where: { id } });
  }

  async findActive() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: CreateProductData, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    return client.product.create({
      data: {
        name: data.name,
        priceInMinorUnits: data.priceInMinorUnits,
        currency: data.currency,
      },
    });
  }
}
