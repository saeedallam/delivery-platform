import { Injectable } from '@nestjs/common';

import { ProductRepository } from './product.repository';
import { ProductNotFoundError } from './errors/product-not-found.error';
import { InactiveProductError } from './errors/inactive-product.error';
import { ProductForOrder } from './contracts/product-for-order.interface';
import { Currency } from './contracts/currency.enum';

@Injectable()
export class ProductsService {
  constructor(private readonly productRepository: ProductRepository) {}

  async findById(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new ProductNotFoundError(id);
    }

    return product;
  }

  async getProductForOrder(productId: string): Promise<ProductForOrder> {
    const product = await this.findById(productId);

    if (!product.isActive) {
      throw new InactiveProductError(productId);
    }

    return {
      productId: product.id,
      priceInMinorUnits: product.priceInMinorUnits,
      currency: product.currency as Currency,
    };
  }
}
