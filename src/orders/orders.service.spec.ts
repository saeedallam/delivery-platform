import { Test } from '@nestjs/testing';

import { OrderStatus } from '../../generated/prisma/enums';
import { UserRole } from '../auth/contracts/user-role.enum';
import { ProductsService } from '../catalog/products.service';

import { OrderRepository } from './order.repository';
import { OrdersService } from './orders.service';

import { ForbiddenOrderTransitionError } from './errors/forbidden-order-transition.error';
import { InvalidOrderTransitionError } from './errors/invalid-order-transition.error';

describe('OrdersService transitions', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: {},
        },
        {
          provide: ProductsService,
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('allows a merchant to confirm a pending order', () => {
    expect(
      service.transitionOrder(
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        UserRole.MERCHANT
      )
    ).toBe(OrderStatus.CONFIRMED);
  });

  it('allows a merchant to start preparation', () => {
    expect(
      service.transitionOrder(
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        UserRole.MERCHANT
      )
    ).toBe(OrderStatus.PREPARING);
  });

  it('does not allow a customer to confirm an order', () => {
    expect(() =>
      service.transitionOrder(
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        UserRole.CUSTOMER
      )
    ).toThrow(ForbiddenOrderTransitionError);
  });

  it('does not allow cancelling a delivered order', () => {
    expect(() =>
      service.transitionOrder(
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        UserRole.CUSTOMER
      )
    ).toThrow(InvalidOrderTransitionError);
  });

  describe.each([UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.DRIVER])(
    'direct delivery transitions for %s',
    (role) => {
      it('blocks direct pickup through the general order flow', () => {
        expect(() =>
          service.transitionOrder(
            OrderStatus.PREPARING,
            OrderStatus.OUT_FOR_DELIVERY,
            role
          )
        ).toThrow(ForbiddenOrderTransitionError);
      });

      it('blocks direct completion through the general order flow', () => {
        expect(() =>
          service.transitionOrder(
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            role
          )
        ).toThrow(ForbiddenOrderTransitionError);
      });
    }
  );
});
