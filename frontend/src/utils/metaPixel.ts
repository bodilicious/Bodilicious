/**
 * Meta Pixel (Facebook Pixel) client-side tracking helper.
 *
 * The base snippet (init + initial PageView) is loaded in index.html.
 * All methods here safely no-op if `window.fbq` is blocked (e.g., ad blockers
 * or headless prerendering).
 */

type FbqFn = {
  (command: 'init', pixelId: string): void;
  (command: 'track', eventName: string, params?: Record<string, unknown>, options?: { eventID?: string }): void;
  (command: 'trackCustom', eventName: string, params?: Record<string, unknown>, options?: { eventID?: string }): void;
};

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

export interface MetaPixelLineItem {
  id: string;
  quantity: number;
  item_price?: number;
}

function getFbq(): FbqFn | null {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return null;
  }
  return window.fbq;
}

/** Fire a PageView event on SPA route transitions. */
export function trackMetaPageView(): void {
  const fbq = getFbq();
  if (!fbq) return;
  fbq('track', 'PageView');
}

/** Fire ViewContent when a shopper views a product detail page. */
export function trackMetaViewContent(params: {
  id: string;
  name?: string;
  category?: string;
  value: number;
  currency?: string;
}): void {
  const fbq = getFbq();
  if (!fbq || !params.id) return;

  fbq('track', 'ViewContent', {
    content_ids: [params.id],
    content_name: params.name,
    content_category: params.category,
    content_type: 'product',
    value: Number(params.value || 0),
    currency: params.currency || 'INR',
  });
}

/** Fire AddToCart when a product is added to the bag. */
export function trackMetaAddToCart(params: {
  id: string;
  name?: string;
  category?: string;
  value: number;
  quantity?: number;
  currency?: string;
}): void {
  const fbq = getFbq();
  if (!fbq || !params.id) return;

  const quantity = Math.max(1, Number(params.quantity || 1));

  fbq('track', 'AddToCart', {
    content_ids: [params.id],
    content_name: params.name,
    content_category: params.category,
    content_type: 'product',
    contents: [{ id: params.id, quantity }],
    value: Number(params.value || 0),
    currency: params.currency || 'INR',
  });
}

/** Fire InitiateCheckout when the shopper proceeds from Cart to Checkout. */
export function trackMetaInitiateCheckout(params: {
  items: MetaPixelLineItem[];
  value: number;
  currency?: string;
}): void {
  const fbq = getFbq();
  if (!fbq) return;

  const validItems = params.items.filter((item) => Boolean(item.id));
  const numItems = validItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

  fbq('track', 'InitiateCheckout', {
    content_ids: validItems.map((item) => item.id),
    content_type: 'product',
    contents: validItems.map((item) => ({
      id: item.id,
      quantity: Math.max(1, Number(item.quantity || 1)),
    })),
    num_items: numItems,
    value: Number(params.value || 0),
    currency: params.currency || 'INR',
  });
}

/**
 * Fire Purchase once per order ID (deduplicated via sessionStorage + Meta eventID
 * so neither async webhook confirmation polling nor page refreshes double-count).
 */
export function trackMetaPurchase(params: {
  orderId: string;
  items: MetaPixelLineItem[];
  value: number;
  currency?: string;
}): void {
  const fbq = getFbq();
  if (!fbq || !params.orderId) return;

  const dedupeKey = `meta_purchase_${params.orderId}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }

  const validItems = params.items.filter((item) => Boolean(item.id));
  const numItems = validItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

  fbq(
    'track',
    'Purchase',
    {
      content_ids: validItems.map((item) => item.id),
      content_type: 'product',
      contents: validItems.map((item) => ({
        id: item.id,
        quantity: Math.max(1, Number(item.quantity || 1)),
        ...(typeof item.item_price === 'number' ? { item_price: item.item_price } : {}),
      })),
      num_items: numItems,
      value: Number(params.value || 0),
      currency: params.currency || 'INR',
    },
    { eventID: params.orderId }
  );
}
