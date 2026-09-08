import { getAppUrl } from '@/lib/get-app-url'
import { logger } from '@/lib/logger'
import { shopifyAdminGraphql } from './admin'

const CALLBACK_URL = () => `${getAppUrl()}/api/shopify/webhooks`

const SUBSCRIBE = `
  mutation Subscribe($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      userErrors { field message }
    }
  }
`

const TOPICS = [
  'APP_UNINSTALLED',
  'PRODUCTS_UPDATE',
  'CUSTOMERS_DATA_REQUEST',
  'CUSTOMERS_REDACT',
  'SHOP_REDACT',
] as const

export async function subscribeShopifyWebhooks(shop: string, accessToken: string): Promise<void> {
  const callbackUrl = CALLBACK_URL()
  for (const topic of TOPICS) {
    try {
      const result = await shopifyAdminGraphql<{
        webhookSubscriptionCreate: { userErrors: Array<{ message: string }> }
      }>(shop, accessToken, SUBSCRIBE, { topic, callbackUrl })
      const errors = result.webhookSubscriptionCreate.userErrors
      if (errors.length) {
        logger.warn('Shopify webhook subscribe userErrors', { shop, topic, errors })
      }
    } catch (error) {
      logger.warn('Shopify webhook subscribe failed', {
        shop,
        topic,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
