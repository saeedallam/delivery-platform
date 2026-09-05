import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import {
  CheckoutSessionResult,
  CreateCheckoutSessionData,
  PaymentGateway,
} from './payment-gateway.interface';
import { PaymentProviderError } from '../errors/payment-provider.error';

@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');

    this.successUrl =
      this.configService.getOrThrow<string>('STRIPE_SUCCESS_URL');

    this.cancelUrl = this.configService.getOrThrow<string>('STRIPE_CANCEL_URL');

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
}
