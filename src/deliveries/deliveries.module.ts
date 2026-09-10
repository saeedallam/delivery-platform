import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { CreateDeliveryUseCase } from './application/create-delivery.use-case';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryRepository } from './delivery.repository';
import { AssignDriverUseCase } from './application/assign-driver.use-case';
import { PickupDeliveryUseCase } from './application/pickup-delivery.use-case';
import { CompleteDeliveryUseCase } from './application/complete-delivery.use-case';

@Module({
  imports: [AuthModule, PrismaModule, OrdersModule],
  controllers: [DeliveriesController],
  providers: [
    DeliveryRepository,
    CreateDeliveryUseCase,
    AssignDriverUseCase,
    PickupDeliveryUseCase,
    CompleteDeliveryUseCase,
  ],
})
export class DeliveriesModule {}
