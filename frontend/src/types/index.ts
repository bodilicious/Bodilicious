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

export interface Product {
  _id?: string;
  pid: string;
  name: string;
  slug?: string;
  brand?: string;
  images: string[];
  description: string;

  category: 'skin' | 'hair' | 'body' | 'makeup' | 'lip' | 'other';
  sub_category?: string;
  product_type?: string;
  item_form?: string;

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
  city: string;
  state: string;
  pincode: string;
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
  razorpaySignature?: string;
  totalAmount: number;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
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
  
  // Real-time EDD
  estimatedDeliveryDate?: string | null;
  estimatedDeliveryDays?: number | null;
  estimatedCourierName?: string | null;
  eddCalculatedAt?: string | null;

  // Admin Timeline
  statusHistory?: {
    status: string;
    changedBy?: string | any;
    changedAt: string;
    note?: string;
  }[];
  adminNote?: string;
}
