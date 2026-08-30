import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderDto
  ) {
    return this.ordersService.createOrder({
      userId: req.user.userId,
      currency: dto.currency,
      items: dto.items,
    });
  }
}
