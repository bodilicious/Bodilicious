export interface Review {
  user: string;
  rating: number;
  comment: string;
  isVerified?: boolean;
  createdAt: string;
}

export interface IngredientData {
  key_actives: string[];
  botanical_extracts: string[];
  others: string[];
}

export interface UsageData {
  time?: string;
  frequency?: string;
  routine_step?: string;
}

export interface SeoKeywords {
  primary?: string[];
  secondary?: string[];
}

export interface Product {
  _id?: string;
  pid: string;
  name: string;
  slug?: string;
  brand?: string;
  images: string[];
  description: string;

  /** Editorial SEO overrides — blank means "generate it" (see utils/seo.ts) */
  seo_title?: string;
  seo_description?: string;
  seo_h1?: string;
  seo_h2?: string[];
  seo_image_alt?: string;
  /** Rendered as visible content + FAQPage structured data. Both fields required. */
  faqs?: { question: string; answer: string }[];
  /** Injected by the API on the detail endpoint — internal linking, not stored. */
  relatedBlogs?: { title: string; slug: string; excerpt?: string; coverImage?: string }[];

  category: 'skin' | 'hair' | 'body' | 'makeup' | 'lip' | 'other';
  sub_category?: string;
  product_type?: string;
  item_form?: string;
  /** Exact Google product taxonomy path — drives <g:google_product_category>
   *  in the Merchant Center feed and schema.org `category` on the product page. */
  google_product_category?: string;

  ingredients?: IngredientData;
  benefits?: string[];
  concerns_targeted?: string[];
  usage?: UsageData;

  rating: number;
  ratingCount: number;
  reviews: Review[];
  price: number;
  price_inr?: number;
  stock: number;
  isActive: boolean;
  lowStockThreshold?: number;
  product_weight_ml?: number;
  product_weight_g?: number;
  availability?: string;
  skin_type_suitable?: string[];
  skin_type_not_suitable?: string[];
  hair_type_suitable?: string[];
  how_to_use?: string[];
  tips?: string[];
  texture?: string;
  warnings?: string[];
  is_active_based?: boolean;
  seo_keywords?: SeoKeywords | string; // keeping string for backwards compatibility during transition
  createdAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type Page = 'home' | 'shop' | 'product' | 'signin' | 'signup' | 'cart' | 'wishlist' | 'account' | 'tracking' | 'order-details' | 'chat' | 'payment' | 'shipping' | 'confirmation' | 'ritual-finder' | 'about' | 'contact' | 'faqs' | 'stores' | 'accessibility' | 'careers' | 'students' | 'privacy' | 'terms' | 'shipping-refund' | 'admin' | 'admin/products' | 'admin/orders' | 'admin/users' | 'admin/analytics' | 'admin/logs' | 'not-found';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'awaiting-verification';

export interface Address {
  _id?: string;
  isDefault: boolean;
  name: string;
  phone: string;
  addressLine: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: 'user' | 'admin' | 'primary_admin';
  isBlocked?: boolean;
  lastLoginAt?: string;
  phone?: string;
  gender?: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';
  dateOfBirth?: string;
  skinType?: 'Oily' | 'Dry' | 'Combination' | 'Sensitive' | 'Normal';
  skinConcerns?: string[];
  preferredRoutine?: 'Morning Routine' | 'Night Routine' | 'Both';
  addresses?: Address[];
  welcomeOfferUsed?: boolean;
  welcomeOffer?: {
    eligible: boolean;
    type: string;
    value: number;
    message: string;
  };

  // Legacy flat address fields for backward compatibility
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface TimelineEvent {
  status: string;
  location: string;
  date: string;
  completed: boolean;
}

export interface Order {
  _id: string;
  awb: string | null;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  totalAmount: number;
  originalAmount?: number;
  shippingCost?: number;
  discountAmount?: number;
  taxAmount?: number;
  currency?: string;
  exchangeRate?: number;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt?: string;
  invoiceNumber?: string | null;
  invoiceGenerated?: boolean;
  isWelcomeOfferApplied?: boolean;
  couponCode?: string | null;
  couponDiscount?: number;
  shippingDetails: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: {
    product: Product;
    quantity: number;
    priceAtPurchase: number;
  }[];
  // Return / Refund
  returnStatus?: 'none' | 'requested' | 'approved' | 'rejected' | 'completed';
  returnReason?: string | null;
  returnRequestedAt?: string | null;
  refundId?: string | null;
  refundStatus?: 'pending' | 'processed' | 'failed' | null;
  refundAmount?: number | null;
  
  // Real-time EDD & Fulfillment
  estimatedDeliveryDate?: string | null;
  estimatedDeliveryDays?: number | null;
  estimatedCourierName?: string | null;
  eddCalculatedAt?: string | null;
  deliveredAt?: string | null;

  customerComments?: {
    text: string;
    createdAt: string;
  }[];
}

export interface AdminOrder extends Order {
  razorpaySignature?: string;
  statusHistory?: {
    status: string;
    changedBy?: string | any;
    changedAt: string;
    note?: string;
  }[];
  adminNote?: string;
  needsManualReview?: boolean;
  reviewReason?: string | null;
  paymentClaimedAt?: string | null;
  lastClaimFailedAt?: string | null;
  paymentLinkId?: string | null;
  paymentLink?: string | null;
  paymentLinkExpiresAt?: string | null;
  billingDetails?: any;
  returnConditionNotes?: string | null;
  returnPhotoUrls?: string[];
  returnRefundMethod?: string | null;
  isStockRestored?: boolean;
  physicalReceived?: boolean;
  returnResolvedAt?: string | null;
  returnShiprocketOrderId?: string | null;
  returnShipmentId?: number | null;
  returnAwb?: string | null;
  shiprocketOrderId?: string | null;
  shipmentId?: number | null;
  marketing?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}
