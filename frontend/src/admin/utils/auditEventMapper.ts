export const mapAuditEvent = (log: any): string => {
  const type = log.event_type;
  const m = log.metadata || {};

  switch (type) {
    case 'CART_ITEM_ADDED':
      return `Added ${m.productName || 'product'} to cart`;
    case 'CART_ITEM_REMOVED':
      return `Removed ${m.productName || 'product'} from cart`;
    case 'USER_LOGIN':
      return 'Logged into the site';
    case 'ORDER_PLACED':
      return `Placed order #${m.orderId || m.order_id || 'unknown'}`;
    case 'PAYMENT_FAILED':
      return `Payment failed (${m.reason || 'Unknown error'})`;
    case 'TICKET_CREATED':
      return `Opened support ticket #${m.ticketId || 'unknown'}`;
    case 'PROFILE_UPDATED':
      return 'Updated profile information';
    case 'REVIEW_SUBMITTED':
      return `Submitted a review for ${m.productName || 'a product'}`;
    case 'WISHLIST_ADD':
      return `Added ${m.productName || 'product'} to wishlist`;
    case 'WISHLIST_REMOVE':
      return `Removed ${m.productName || 'product'} from wishlist`;
    case 'ADDRESS_ADDED':
      return 'Added a new shipping address';
    default:
      // Fallback with warning
      console.warn(`[AuditMapper] Unknown event type encountered: ${type}`, log);
      return type
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
  }
};
