import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CatalogModule } from '../catalog/catalog.module';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRepository } from './order.repository';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryModule } from 'src/inventory/inventory.module';
import { PlaceOrderUseCase } from './application/place-order.use-case';

@Module({
  imports: [PrismaModule, CatalogModule, InventoryModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderRepository,
    PlaceOrderUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
