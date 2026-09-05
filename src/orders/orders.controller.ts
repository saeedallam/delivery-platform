import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { OrdersService } from './orders.service';
import { PlaceOrderUseCase } from './application/place-order.use-case';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly placeOrderUseCase: PlaceOrderUseCase
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderDto
  ) {
    return this.placeOrderUseCase.execute({
      userId: req.user.userId,
      items: dto.items,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':orderId/status')
  async changeStatus(
    @Param('orderId') orderId: string,
    @Body() dto: ChangeOrderStatusDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.ordersService.changeStatus(
      orderId,
      dto.nextStatus,
      req.user.role
    );
  }
}
