import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../auth/contracts/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateProductUseCase } from './application/create-product.use-case';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class CatalogController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly createProductUseCase: CreateProductUseCase
  ) {}

  @Get()
  async getActiveProducts() {
    return this.productsService.findActive();
  }

  @Get(':id')
  async getProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @Post()
  async createProduct(@Body() dto: CreateProductDto) {
    return this.createProductUseCase.execute(dto);
  }
}
