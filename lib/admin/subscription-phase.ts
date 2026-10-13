import type Stripe from 'stripe'
function id(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id
}
/** Preserve current recurring financial settings when scheduling a plan change. */
export function subscriptionPhaseSettings(
  phase: Stripe.SubscriptionSchedule.Phase | undefined,
): Omit<Stripe.SubscriptionScheduleUpdateParams.Phase, 'items'> {
  if (!phase) return {}
  return {
    ...(phase.application_fee_percent !== null
      ? { application_fee_percent: phase.application_fee_percent }
      : {}),
    ...(phase.automatic_tax
      ? {
          automatic_tax: {
            enabled: phase.automatic_tax.enabled,
            ...(phase.automatic_tax.liability
              ? {
                  liability: {
                    type: phase.automatic_tax.liability.type,
                    ...(id(phase.automatic_tax.liability.account)
                      ? { account: id(phase.automatic_tax.liability.account) }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(phase.billing_cycle_anchor ? { billing_cycle_anchor: phase.billing_cycle_anchor } : {}),
    ...(phase.billing_thresholds
      ? {
          billing_thresholds: {
            ...(phase.billing_thresholds.amount_gte !== null
              ? { amount_gte: phase.billing_thresholds.amount_gte }
              : {}),
            ...(phase.billing_thresholds.reset_billing_cycle_anchor !== null
              ? { reset_billing_cycle_anchor: phase.billing_thresholds.reset_billing_cycle_anchor }
              : {}),
          },
        }
      : {}),
    ...(phase.collection_method ? { collection_method: phase.collection_method } : {}),
    currency: phase.currency,
    ...(id(phase.default_payment_method)
      ? { default_payment_method: id(phase.default_payment_method) }
      : {}),
    default_tax_rates: phase.default_tax_rates?.map((t) => t.id) ?? [],
    ...(phase.description ? { description: phase.description } : {}),
    discounts: phase.discounts.map((d) => ({
      ...(id(d.discount)
        ? { discount: id(d.discount) }
        : id(d.promotion_code)
          ? { promotion_code: id(d.promotion_code) }
          : { coupon: id(d.coupon)! }),
    })),
    ...(!phase.discounts.length && id(phase.coupon) ? { coupon: id(phase.coupon) } : {}),
    ...(phase.invoice_settings
      ? {
          invoice_settings: {
            ...(phase.invoice_settings.issuer
              ? {
                  issuer: {
                    type: phase.invoice_settings.issuer.type,
                    ...(id(phase.invoice_settings.issuer.account)
                      ? { account: id(phase.invoice_settings.issuer.account) }
                      : {}),
                  },
                }
              : {}),
            ...(phase.invoice_settings.days_until_due !== null
              ? { days_until_due: phase.invoice_settings.days_until_due }
              : {}),
            ...(phase.invoice_settings.account_tax_ids
              ? { account_tax_ids: phase.invoice_settings.account_tax_ids.map((t) => id(t)!) }
              : {}),
          },
        }
      : {}),
    ...(phase.metadata ? { metadata: phase.metadata } : {}),
    ...(id(phase.on_behalf_of) ? { on_behalf_of: id(phase.on_behalf_of) } : {}),
    ...(phase.transfer_data
      ? {
          transfer_data: {
            destination: id(phase.transfer_data.destination)!,
            ...(phase.transfer_data.amount_percent !== null
              ? { amount_percent: phase.transfer_data.amount_percent }
              : {}),
          },
        }
      : {}),
  }
}

export function subscriptionPhaseItems(phase: Stripe.SubscriptionSchedule.Phase) {
  return phase.items.map((item) => ({
    price: id(item.price)!,
    quantity: item.quantity ?? 1,
    ...(item.billing_thresholds?.usage_gte != null
      ? { billing_thresholds: { usage_gte: item.billing_thresholds.usage_gte } }
      : {}),
    discounts: item.discounts.map((d) =>
      id(d.discount)
        ? { discount: id(d.discount) }
        : id(d.promotion_code)
          ? { promotion_code: id(d.promotion_code) }
          : { coupon: id(d.coupon)! },
    ),
    ...(item.metadata ? { metadata: item.metadata } : {}),
    tax_rates: item.tax_rates?.map((t) => t.id) ?? [],
  }))
}
