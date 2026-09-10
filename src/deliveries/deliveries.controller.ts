import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { UserRole } from '../auth/contracts/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { CreateDeliveryUseCase } from './application/create-delivery.use-case';
import { AssignDriverUseCase } from './application/assign-driver.use-case';
import { PickupDeliveryUseCase } from './application/pickup-delivery.use-case';
import { CompleteDeliveryUseCase } from './application/complete-delivery.use-case';

import { AssignDriverDto } from './dto/assign-driver.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('orders')
export class DeliveriesController {
  constructor(
    private readonly createDeliveryUseCase: CreateDeliveryUseCase,
    private readonly assignDriverUseCase: AssignDriverUseCase,
    private readonly pickupDeliveryUseCase: PickupDeliveryUseCase,
    private readonly completeDeliveryUseCase: CompleteDeliveryUseCase
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Post(':orderId/delivery')
  async createDelivery(@Param('orderId') orderId: string) {
    return this.createDeliveryUseCase.execute(orderId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Patch('deliveries/:deliveryId/driver')
  async assignDriver(
    @Param('deliveryId') deliveryId: string,
    @Body() dto: AssignDriverDto
  ) {
    return this.assignDriverUseCase.execute(deliveryId, dto.driverId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @Patch('deliveries/:deliveryId/pickup')
  async pickupDelivery(
    @Param('deliveryId') deliveryId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.pickupDeliveryUseCase.execute(deliveryId, request.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @Patch('deliveries/:deliveryId/complete')
  async completeDelivery(
    @Param('deliveryId') deliveryId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.completeDeliveryUseCase.execute(
      deliveryId,
      request.user.userId
    );
  }
}
