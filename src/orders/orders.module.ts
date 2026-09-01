import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CatalogModule } from '../catalog/catalog.module';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRepository } from './order.repository';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [PrismaModule, CatalogModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRepository, JwtAuthGuard, RolesGuard],
})
export class OrdersModule {}
