import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ProductsService } from './products.service';
import { ProductRepository } from './product.repository';

@Module({
  imports: [PrismaModule],
  providers: [ProductsService, ProductRepository],
  exports: [ProductsService],
})
export class CatalogModule {}
