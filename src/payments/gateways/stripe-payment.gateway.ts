import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { Currency } from '../../catalog/contracts/currency.enum';

import type {
  CheckoutSessionResult,
  CreateCheckoutSessionData,
  PaymentGateway,
} from './payment-gateway.interface';

import type { PaymentProviderEvent } from '../contracts/payment-provider-event.type';

import { InvalidPaymentWebhookError } from '../errors/invalid-payment-webhook.error';
import { PaymentProviderError } from '../errors/payment-provider.error';

interface CheckoutSessionPaymentData {
  paymentId: string;
  providerSessionId: string;
  amountInMinorUnits: number;
  currency: Currency;
}

@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly successUrl: string;
  private readonly cancelUrl: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');

    this.successUrl =
      this.configService.getOrThrow<string>('STRIPE_SUCCESS_URL');

    this.cancelUrl = this.configService.getOrThrow<string>('STRIPE_CANCEL_URL');

    this.webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET'
    );

    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(
    data: CreateCheckoutSessionData
  ): Promise<CheckoutSessionResult> {
    try {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',

          success_url: this.successUrl,
          cancel_url: this.cancelUrl,

          client_reference_id: data.orderId,

          line_items: [
            {
              quantity: 1,

              price_data: {
                currency: data.currency.toLowerCase(),
                unit_amount: data.amountInMinorUnits,

                product_data: {
                  name: `Order ${data.orderId}`,
                },
              },
            },
          ],

          metadata: {
            paymentId: data.paymentId,
            orderId: data.orderId,
          },

          payment_intent_data: {
            metadata: {
              paymentId: data.paymentId,
              orderId: data.orderId,
            },
          },
        },
        {
          idempotencyKey: `payment:${data.paymentId}:checkout`,
        }
      );

      if (!session.url) {
        throw new PaymentProviderError(
          'Stripe checkout session did not return a URL'
        );
      }

      return {
        providerSessionId: session.id,
        checkoutUrl: session.url,

        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000)
          : null,
      };
    } catch (error: unknown) {
      if (error instanceof PaymentProviderError) {
        throw error;
      }

      throw new PaymentProviderError(
        'Failed to create Stripe checkout session',
        error
      );
    }
  }

  verifyAndParseWebhookEvent(
    rawBody: Buffer,
    signature: string
  ): PaymentProviderEvent {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );
    } catch (error: unknown) {
      throw new InvalidPaymentWebhookError(error);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      if (session.payment_status !== 'paid') {
        return {
          type: 'IGNORED',
          providerEventId: event.id,
          providerEventType: event.type,
        };
      }

      const paymentData = this.mapCheckoutSessionPaymentData(session);

      const providerPaymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!providerPaymentId) {
        throw new InvalidPaymentWebhookError(
          new Error('Paid Stripe Checkout Session is missing Payment Intent')
        );
      }

      return {
        type: 'PAYMENT_SUCCEEDED',
        providerEventId: event.id,
        ...paymentData,
        providerPaymentId,
        occurredAt: new Date(event.created * 1000),
      };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;

      const paymentData = this.mapCheckoutSessionPaymentData(session);

      return {
        type: 'PAYMENT_EXPIRED',
        providerEventId: event.id,
        ...paymentData,
        occurredAt: new Date(event.created * 1000),
      };
    }

    return {
      type: 'IGNORED',
      providerEventId: event.id,
      providerEventType: event.type,
    };
  }

  private mapCheckoutSessionPaymentData(
    session: Stripe.Checkout.Session
  ): CheckoutSessionPaymentData {
    const paymentId = session.metadata?.paymentId;
    const amountInMinorUnits = session.amount_total;

    const currency = Object.values(Currency).find(
      (value) => value.toLowerCase() === session.currency
    );

    if (!paymentId || amountInMinorUnits === null || !currency) {
      throw new InvalidPaymentWebhookError(
        new Error('Stripe Checkout Session is missing required payment data')
      );
    }

    return {
      paymentId,
      providerSessionId: session.id,
      amountInMinorUnits,
      currency,
    };
  }
}
