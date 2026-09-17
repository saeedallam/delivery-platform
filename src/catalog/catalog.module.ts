import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CatalogController } from './catalog.controller';
import { CreateProductUseCase } from './application/create-product.use-case';
import { ProductRepository } from './product.repository';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule],
  controllers: [CatalogController],
  providers: [ProductsService, ProductRepository, CreateProductUseCase],
  exports: [ProductsService],
})
export class CatalogModule {}
