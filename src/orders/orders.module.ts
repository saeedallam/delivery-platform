import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderRepository } from './order.repository';

@Module({
  controllers: [OrdersController],

  providers: [OrdersService, OrderRepository, JwtAuthGuard, RolesGuard],
})
export class OrdersModule {}
