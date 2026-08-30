import { OrderStatus } from '../../generated/prisma/enums';
import { UserRole } from '../auth/contracts/user-role.enum';
import { ForbiddenOrderTransitionError } from './errors/forbidden-order-transition.error';
import { InvalidOrderTransitionError } from './errors/invalid-order-transition.error';
import { OrdersService } from './orders.service';

describe('transitionOrder', () => {
  it('should allow a merchant to confirm a pending order', () => {
    const service = new OrdersService();

    const result = service.transitionOrder(
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      UserRole.MERCHANT,
    );

    expect(result).toBe(OrderStatus.CONFIRMED);
  });

  it('should not allow a customer to confirm a pending order', () => {
    const service = new OrdersService();

    expect(() => {
      service.transitionOrder(
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        UserRole.CUSTOMER,
      );
    }).toThrow(ForbiddenOrderTransitionError);
  });

  it('should not allow cancelling a delivered order', () => {
  const service = new OrdersService();

  expect(() => {
    service.transitionOrder(
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      UserRole.CUSTOMER,
    );
  }).toThrow(InvalidOrderTransitionError);
});

it('should allow a driver to do transiate OUT_TO_DELIVERY ->DELIVERED', ()=>{
  const service = new OrdersService();
  const result = service.transitionOrder(
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  UserRole.DRIVER,
);

expect(result).toBe(OrderStatus.DELIVERED);
})
});