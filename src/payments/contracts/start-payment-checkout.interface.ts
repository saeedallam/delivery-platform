export interface StartPaymentCheckoutData {
  orderId: string;
  userId: string;
}

export interface StartPaymentCheckoutResult {
  paymentId: string;
  checkoutUrl: string;
  expiresAt: Date | null;
}
