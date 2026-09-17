import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryRepository } from '../../inventory/inventory.repository';

import { Currency } from '../contracts/currency.enum';
import { ProductRepository } from '../product.repository';
import { CreateProductUseCase } from './create-product.use-case';

describe('CreateProductUseCase', () => {
  const transactionClient = {};

  const input = {
    name: 'New Product',
    priceInMinorUnits: 2000,
    currency: Currency.USD,
    initialQuantity: 15,
  };

  const createdProduct = {
    id: 'product-uuid-1',
    name: input.name,
    priceInMinorUnits: input.priceInMinorUnits,
    currency: input.currency,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let useCase: CreateProductUseCase;

  let prisma: {
    $transaction: jest.Mock;
  };

  let productRepository: {
    create: jest.Mock;
  };

  let inventoryRepository: {
    create: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(
        async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient)
      ),
    };

    productRepository = {
      create: jest.fn().mockResolvedValue(createdProduct),
    };

    inventoryRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'inventory-uuid-1',
        productId: createdProduct.id,
        quantity: input.initialQuantity,
        reservedQuantity: 0,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateProductUseCase,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ProductRepository,
          useValue: productRepository,
        },
        {
          provide: InventoryRepository,
          useValue: inventoryRepository,
        },
      ],
    }).compile();

    useCase = moduleRef.get<CreateProductUseCase>(CreateProductUseCase);
  });

  it('creates the product and initial inventory using the same transaction', async () => {
    const result = await useCase.execute(input);

    expect(result).toBe(createdProduct);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(productRepository.create).toHaveBeenCalledWith(
      {
        name: input.name,
        priceInMinorUnits: input.priceInMinorUnits,
        currency: input.currency,
      },
      transactionClient
    );

    expect(inventoryRepository.create).toHaveBeenCalledWith(
      createdProduct.id,
      input.initialQuantity,
      transactionClient
    );
  });

  it('fails the transaction when inventory creation fails', async () => {
    const inventoryError = new Error('Database write error on inventory');
    inventoryRepository.create.mockRejectedValue(inventoryError);

    await expect(useCase.execute(input)).rejects.toThrow(inventoryError);

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.anything(),
      transactionClient
    );
    expect(inventoryRepository.create).toHaveBeenCalledWith(
      createdProduct.id,
      input.initialQuantity,
      transactionClient
    );
  });
});
