// Billing Configuration - Product and entitlement identifiers for RevenueCat

import { Capacitor } from '@capacitor/core';

// Entitlement identifier - matches RevenueCat dashboard
export const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers - matches RevenueCat dashboard and store products
export const BILLING_CONFIG = {
  weekly: {
    productId: 'npd_wk',
    basePlanId: 'npd-wk-plan',
    offerId: 'npd-wk-trial',
  },
  monthly: {
    productId: 'monthly',
    basePlanId: 'npd-mo',
    offerId: 'npd-monthly-offer',
  },
  lifetime: {
    productId: 'npd_lv',
    basePlanId: 'npd-lv',
    offerId: '',
  },
} as const;

export type PlanType = keyof typeof BILLING_CONFIG;

export interface SubscriptionProduct {
  productId: string;
  basePlanId: string;
  offerId: string;
}

export const getSubscriptionDetails = (plan: PlanType): SubscriptionProduct => {
  return BILLING_CONFIG[plan];
};

// Pricing display (for UI only - actual pricing comes from RevenueCat/Store)
export const PRICING_DISPLAY = {
  weekly: {
    price: '$2.99',
    period: 'week',
    displayPrice: '$2.99/wk',
    trialDays: 1,
  },
  monthly: {
    price: '$5.99',
    period: 'month',
    displayPrice: '$5.99/mo',
  },
  lifetime: {
    price: '$79.99',
    period: 'lifetime',
    displayPrice: '$79.99',
    note: 'One-time payment',
  },
} as const;

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};
