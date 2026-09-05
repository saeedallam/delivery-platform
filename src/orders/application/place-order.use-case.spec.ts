import { Test } from '@nestjs/testing';

import { Currency } from '../../catalog/contracts/currency.enum';
import { InsufficientStockError } from '../../inventory/errors/insufficient-stock.error';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { InventoryService } from '../../inventory/inventory.service';
import { PrismaService } from '../../prisma/prisma.service';

import { OrderRepository } from '../order.repository';
import { OrdersService } from '../orders.service';
import { PlaceOrderUseCase } from './place-order.use-case';

describe('PlaceOrderUseCase', () => {
  const transactionClient = {};

  const input = {
    userId: 'user-1',
    items: [
      {
        productId: 'product-1',
        quantity: 2,
      },
      {
        productId: 'product-2',
        quantity: 1,
      },
    ],
  };

  const orderData = {
    userId: 'user-1',
    currency: Currency.USD,
    totalAmountInMinorUnits: 4500,
    items: [
      {
        productId: 'product-1',
        quantity: 2,
        unitPriceInMinorUnits: 1000,
      },
      {
        productId: 'product-2',
        quantity: 1,
        unitPriceInMinorUnits: 2500,
      },
    ],
  };

  let placeOrderUseCase: PlaceOrderUseCase;

  let prisma: {
    $transaction: jest.Mock;
  };

  let ordersService: {
    prepareOrderData: jest.Mock;
  };

  let orderRepository: {
    createOrder: jest.Mock;
  };

  let inventoryRepository: {
    reserveStock: jest.Mock;
    findByProductId: jest.Mock;
  };

  let inventoryService: {
    interpretReservationResult: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(
        async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient)
      ),
    };

    ordersService = {
      prepareOrderData: jest.fn().mockResolvedValue(orderData),
    };

    orderRepository = {
      createOrder: jest.fn(),
    };

    inventoryRepository = {
      reserveStock: jest.fn(),
      findByProductId: jest.fn(),
    };

    inventoryService = {
      interpretReservationResult: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlaceOrderUseCase,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: OrdersService,
          useValue: ordersService,
        },
        {
          provide: OrderRepository,
          useValue: orderRepository,
        },
        {
          provide: InventoryRepository,
          useValue: inventoryRepository,
        },
        {
          provide: InventoryService,
          useValue: inventoryService,
        },
      ],
    }).compile();

    placeOrderUseCase = moduleRef.get<PlaceOrderUseCase>(PlaceOrderUseCase);
  });

  it('reserves every item and creates the order using the same transaction', async () => {
    const createdOrder = {
      id: 'order-1',
    };

    inventoryRepository.reserveStock
      .mockResolvedValueOnce({ id: 'inventory-1' })
      .mockResolvedValueOnce({ id: 'inventory-2' });

    orderRepository.createOrder.mockResolvedValue(createdOrder);

    const result = await placeOrderUseCase.execute(input);

    expect(result).toBe(createdOrder);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(inventoryRepository.reserveStock).toHaveBeenNthCalledWith(
      1,
      'product-1',
      2,
      transactionClient
    );

    expect(inventoryRepository.reserveStock).toHaveBeenNthCalledWith(
      2,
      'product-2',
      1,
      transactionClient
    );

    expect(orderRepository.createOrder).toHaveBeenCalledWith(
      orderData,
      transactionClient
    );
  });

  it('does not create the order when an inventory reservation fails', async () => {
    inventoryRepository.reserveStock
      .mockResolvedValueOnce({ id: 'inventory-1' })
      .mockResolvedValueOnce(null);

    inventoryRepository.findByProductId.mockResolvedValue({
      quantity: 1,
      reservedQuantity: 1,
    });

    inventoryService.interpretReservationResult
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new InsufficientStockError('product-2', 1, 0);
      });

    await expect(placeOrderUseCase.execute(input)).rejects.toThrow(
      InsufficientStockError
    );

    expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(
      'product-2',
      transactionClient
    );

    expect(orderRepository.createOrder).not.toHaveBeenCalled();
  });
});
