import { Test } from '@nestjs/testing';

import { Currency } from '../../catalog/contracts/currency.enum';
import { InventoryReleaseConflictError } from '../../inventory/errors/inventory-release-conflict.error';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { InventoryService } from '../../inventory/inventory.service';
import { OrderRepository } from '../../orders/order.repository';
import { OrdersService } from '../../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';

import { HandlePaymentWebhookUseCase } from './handle-payment-webhook.use-case';
import { StartPaymentCheckoutUseCase } from './start-payment-checkout.use-case';
import { PaymentStatus } from '../contracts/payment-status.enum';
import { InvalidPaymentWebhookError } from '../errors/invalid-payment-webhook.error';
import { PaymentCheckoutNotAllowedError } from '../errors/payment-checkout-not-allowed.error';
import { PaymentStateConflictError } from '../errors/payment-state-conflict.error';
import { PAYMENT_GATEWAY } from '../gateways/payment-gateway.interface';
import { PaymentRepository } from '../payment.repository';

describe('Payment flow use cases', () => {
  const transactionClient = {};

  const expiresAt = new Date('2026-09-08T14:07:47.000Z');
  const occurredAt = new Date('2026-09-07T14:09:22.000Z');
  const createdAt = new Date('2026-09-07T14:06:59.000Z');

  const trustedOrder = {
    id: 'order-1',
    userId: 'user-1',
    totalAmountInMinorUnits: 1000,
    currency: Currency.USD,
  };

  const pendingPayment = {
    id: 'payment-1',
    orderId: 'order-1',
    userId: 'user-1',
    amountInMinorUnits: 1000,
    currency: Currency.USD,
    status: PaymentStatus.PENDING,
    providerSessionId: null,
    providerPaymentId: null,
    failureReason: null,
    expiresAt: null,
    paidAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  const processingPayment = {
    ...pendingPayment,
    status: PaymentStatus.PROCESSING,
    providerSessionId: 'cs_test_1',
    expiresAt,
  };

  const succeededPayment = {
    ...processingPayment,
    status: PaymentStatus.SUCCEEDED,
    providerPaymentId: 'pi_1',
    paidAt: occurredAt,
  };

  const expiredPayment = {
    ...processingPayment,
    status: PaymentStatus.EXPIRED,
    failureReason: 'Stripe Checkout Session expired',
  };

  const succeededEvent = {
    type: 'PAYMENT_SUCCEEDED' as const,
    providerEventId: 'evt_success_1',
    paymentId: 'payment-1',
    providerSessionId: 'cs_test_1',
    providerPaymentId: 'pi_1',
    amountInMinorUnits: 1000,
    currency: Currency.USD,
    occurredAt,
  };

  const expiredEvent = {
    type: 'PAYMENT_EXPIRED' as const,
    providerEventId: 'evt_expired_1',
    paymentId: 'payment-1',
    providerSessionId: 'cs_test_1',
    amountInMinorUnits: 1000,
    currency: Currency.USD,
    occurredAt,
  };

  const rawBody = Buffer.from('{"id":"evt_test"}');
  const signature = 'test-signature';

  let startPaymentCheckoutUseCase: StartPaymentCheckoutUseCase;
  let handlePaymentWebhookUseCase: HandlePaymentWebhookUseCase;

  let prisma: {
    $transaction: jest.Mock;
  };

  let ordersService: {
    getOrderForPayment: jest.Mock;
  };

  let orderRepository: {
    findById: jest.Mock;
  };

  let paymentRepository: {
    findOrCreateForOrder: jest.Mock;
    attachCheckoutSession: jest.Mock;
    markSucceeded: jest.Mock;
    markExpired: jest.Mock;
  };

  let inventoryRepository: {
    releaseStock: jest.Mock;
    findByProductId: jest.Mock;
  };

  let inventoryService: {
    interpretReleaseResult: jest.Mock;
  };

  let paymentGateway: {
    createCheckoutSession: jest.Mock;
    verifyAndParseWebhookEvent: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(
        async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient)
      ),
    };

    ordersService = {
      getOrderForPayment: jest.fn(),
    };

    orderRepository = {
      findById: jest.fn(),
    };

    paymentRepository = {
      findOrCreateForOrder: jest.fn(),
      attachCheckoutSession: jest.fn(),
      markSucceeded: jest.fn(),
      markExpired: jest.fn(),
    };

    inventoryRepository = {
      releaseStock: jest.fn(),
      findByProductId: jest.fn(),
    };

    inventoryService = {
      interpretReleaseResult: jest.fn(),
    };

    paymentGateway = {
      createCheckoutSession: jest.fn(),
      verifyAndParseWebhookEvent: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StartPaymentCheckoutUseCase,
        HandlePaymentWebhookUseCase,
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
          provide: PaymentRepository,
          useValue: paymentRepository,
        },
        {
          provide: InventoryRepository,
          useValue: inventoryRepository,
        },
        {
          provide: InventoryService,
          useValue: inventoryService,
        },
        {
          provide: PAYMENT_GATEWAY,
          useValue: paymentGateway,
        },
      ],
    }).compile();

    startPaymentCheckoutUseCase = moduleRef.get<StartPaymentCheckoutUseCase>(
      StartPaymentCheckoutUseCase
    );

    handlePaymentWebhookUseCase = moduleRef.get<HandlePaymentWebhookUseCase>(
      HandlePaymentWebhookUseCase
    );
  });

  describe('StartPaymentCheckoutUseCase', () => {
    it('creates checkout using the trusted order amount and currency', async () => {
      ordersService.getOrderForPayment.mockResolvedValue(trustedOrder);

      paymentRepository.findOrCreateForOrder.mockResolvedValue(pendingPayment);

      paymentGateway.createCheckoutSession.mockResolvedValue({
        providerSessionId: 'cs_test_1',
        checkoutUrl: 'https://checkout.stripe.test/session-1',
        expiresAt,
      });

      paymentRepository.attachCheckoutSession.mockResolvedValue(
        processingPayment
      );

      const result = await startPaymentCheckoutUseCase.execute({
        orderId: 'order-1',
        userId: 'user-1',
      });

      expect(result).toEqual({
        paymentId: 'payment-1',
        checkoutUrl: 'https://checkout.stripe.test/session-1',
        expiresAt,
      });

      expect(ordersService.getOrderForPayment).toHaveBeenCalledWith(
        'order-1',
        'user-1'
      );

      expect(paymentRepository.findOrCreateForOrder).toHaveBeenCalledWith({
        orderId: 'order-1',
        userId: 'user-1',
        amountInMinorUnits: 1000,
        currency: Currency.USD,
      });

      expect(paymentGateway.createCheckoutSession).toHaveBeenCalledWith({
        paymentId: 'payment-1',
        orderId: 'order-1',
        amountInMinorUnits: 1000,
        currency: Currency.USD,
      });

      expect(paymentRepository.attachCheckoutSession).toHaveBeenCalledWith(
        'payment-1',
        'cs_test_1',
        expiresAt
      );
    });

    it('does not create checkout when payment state is not allowed', async () => {
      ordersService.getOrderForPayment.mockResolvedValue(trustedOrder);

      paymentRepository.findOrCreateForOrder.mockResolvedValue(
        succeededPayment
      );

      await expect(
        startPaymentCheckoutUseCase.execute({
          orderId: 'order-1',
          userId: 'user-1',
        })
      ).rejects.toThrow(PaymentCheckoutNotAllowedError);

      expect(paymentGateway.createCheckoutSession).not.toHaveBeenCalled();
      expect(paymentRepository.attachCheckoutSession).not.toHaveBeenCalled();
    });
  });

  describe('HandlePaymentWebhookUseCase', () => {
    it('ignores provider events that the application does not handle', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockReturnValue({
        type: 'IGNORED',
        providerEventId: 'evt_ignored_1',
        providerEventType: 'charge.updated',
      });

      await handlePaymentWebhookUseCase.execute(rawBody, signature);

      expect(paymentGateway.verifyAndParseWebhookEvent).toHaveBeenCalledWith(
        rawBody,
        signature
      );

      expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
      expect(paymentRepository.markExpired).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks payment as succeeded using verified provider data', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockReturnValue(succeededEvent);

      paymentRepository.markSucceeded.mockResolvedValue(succeededPayment);

      await handlePaymentWebhookUseCase.execute(rawBody, signature);

      expect(paymentRepository.markSucceeded).toHaveBeenCalledWith({
        paymentId: 'payment-1',
        providerSessionId: 'cs_test_1',
        providerPaymentId: 'pi_1',
        amountInMinorUnits: 1000,
        currency: Currency.USD,
        paidAt: occurredAt,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(inventoryRepository.releaseStock).not.toHaveBeenCalled();
    });

    it('expires payment and releases every order item using the same transaction', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockReturnValue(expiredEvent);

      paymentRepository.markExpired.mockResolvedValue({
        payment: expiredPayment,
        transitioned: true,
      });

      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
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
      });

      inventoryRepository.releaseStock
        .mockResolvedValueOnce({ id: 'inventory-1' })
        .mockResolvedValueOnce({ id: 'inventory-2' });

      await handlePaymentWebhookUseCase.execute(rawBody, signature);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(paymentRepository.markExpired).toHaveBeenCalledWith(
        {
          paymentId: 'payment-1',
          providerSessionId: 'cs_test_1',
          amountInMinorUnits: 1000,
          currency: Currency.USD,
        },
        transactionClient
      );

      expect(orderRepository.findById).toHaveBeenCalledWith(
        'order-1',
        transactionClient
      );

      expect(inventoryRepository.releaseStock).toHaveBeenNthCalledWith(
        1,
        'product-1',
        2,
        transactionClient
      );

      expect(inventoryRepository.releaseStock).toHaveBeenNthCalledWith(
        2,
        'product-2',
        1,
        transactionClient
      );

      expect(inventoryService.interpretReleaseResult).toHaveBeenNthCalledWith(
        1,
        'product-1',
        2,
        true,
        null
      );

      expect(inventoryService.interpretReleaseResult).toHaveBeenNthCalledWith(
        2,
        'product-2',
        1,
        true,
        null
      );

      expect(inventoryRepository.findByProductId).not.toHaveBeenCalled();
    });

    it('does not release inventory twice when the expired webhook is repeated', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockReturnValue(expiredEvent);

      paymentRepository.markExpired
        .mockResolvedValueOnce({
          payment: expiredPayment,
          transitioned: true,
        })
        .mockResolvedValueOnce({
          payment: expiredPayment,
          transitioned: false,
        });

      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
        items: [
          {
            productId: 'product-1',
            quantity: 1,
          },
        ],
      });

      inventoryRepository.releaseStock.mockResolvedValue({
        id: 'inventory-1',
      });

      await handlePaymentWebhookUseCase.execute(rawBody, signature);
      await handlePaymentWebhookUseCase.execute(rawBody, signature);

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(paymentRepository.markExpired).toHaveBeenCalledTimes(2);
      expect(orderRepository.findById).toHaveBeenCalledTimes(1);
      expect(inventoryRepository.releaseStock).toHaveBeenCalledTimes(1);
    });

    it('fails the transaction when an inventory item cannot be released', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockReturnValue(expiredEvent);

      paymentRepository.markExpired.mockResolvedValue({
        payment: expiredPayment,
        transitioned: true,
      });

      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
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
      });

      inventoryRepository.releaseStock
        .mockResolvedValueOnce({ id: 'inventory-1' })
        .mockResolvedValueOnce(null);

      inventoryRepository.findByProductId.mockResolvedValue({
        reservedQuantity: 0,
      });

      inventoryService.interpretReleaseResult
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new InventoryReleaseConflictError('product-2', 1, 0);
        });

      await expect(
        handlePaymentWebhookUseCase.execute(rawBody, signature)
      ).rejects.toThrow(InventoryReleaseConflictError);

      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(
        'product-2',
        transactionClient
      );

      expect(inventoryRepository.releaseStock).toHaveBeenCalledTimes(2);
    });

    it('does not write anything when webhook verification fails', async () => {
      paymentGateway.verifyAndParseWebhookEvent.mockImplementation(() => {
        throw new InvalidPaymentWebhookError(
          new Error('Invalid test signature')
        );
      });

      await expect(
        handlePaymentWebhookUseCase.execute(rawBody, signature)
      ).rejects.toThrow(InvalidPaymentWebhookError);

      expect(paymentRepository.markSucceeded).not.toHaveBeenCalled();
      expect(paymentRepository.markExpired).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe('PaymentRepository.markExpired', () => {
  const input = {
    paymentId: 'payment-1',
    providerSessionId: 'cs_test_1',
    amountInMinorUnits: 1000,
    currency: Currency.USD,
  };

  const expiredDatabasePayment = {
    id: 'payment-1',
    orderId: 'order-1',
    userId: 'user-1',
    amountInMinorUnits: 1000,
    currency: Currency.USD,
    status: PaymentStatus.EXPIRED,
    providerSessionId: 'cs_test_1',
    providerPaymentId: null,
    failureReason: 'Stripe Checkout Session expired',
    expiresAt: new Date('2026-09-08T14:07:47.000Z'),
    paidAt: null,
    createdAt: new Date('2026-09-07T14:06:59.000Z'),
    updatedAt: new Date('2026-09-07T14:09:22.000Z'),
  };

  let paymentRepository: PaymentRepository;

  let prisma: {
    payment: {
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    paymentRepository = moduleRef.get<PaymentRepository>(PaymentRepository);
  });

  it('returns transitioned true for the first valid expiration', async () => {
    prisma.payment.updateMany.mockResolvedValue({
      count: 1,
    });

    prisma.payment.findUnique.mockResolvedValue(expiredDatabasePayment);

    const result = await paymentRepository.markExpired(input);

    expect(result.transitioned).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.PROCESSING,
        providerSessionId: 'cs_test_1',
        providerPaymentId: null,
        amountInMinorUnits: 1000,
        currency: Currency.USD,
      },
      data: {
        status: PaymentStatus.EXPIRED,
        failureReason: 'Stripe Checkout Session expired',
      },
    });
  });

  it('returns transitioned false for the same repeated expiration', async () => {
    prisma.payment.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.payment.findUnique.mockResolvedValue(expiredDatabasePayment);

    const result = await paymentRepository.markExpired(input);

    expect(result.transitioned).toBe(false);
    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);
  });

  it('throws when the existing payment does not match the expiration', async () => {
    prisma.payment.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.payment.findUnique.mockResolvedValue({
      ...expiredDatabasePayment,
      status: PaymentStatus.SUCCEEDED,
      providerPaymentId: 'pi_1',
    });

    await expect(paymentRepository.markExpired(input)).rejects.toThrow(
      PaymentStateConflictError
    );
  });
});
