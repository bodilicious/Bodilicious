 
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  getIdToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  reload,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../firebase';
import {
  User,
  Product,
  CartItem,
  Order,
  Page,
  AuthStatus,
  Address
} from '../types';
import { usePostHog } from 'posthog-js/react';

/* ================================
   Types
================================ */

export interface ShippingDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface AppContextType {
  products: Product[];
  totalProducts: number;
  isLoading: boolean;
  error: string | null;
  filters: any; // Metadata for Shop filters

  currentPage: Page;
  selectedProductPid: string | null;
  selectedOrderId: string | null;
  shopFilter: 'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup' | 'other';

  cartItems: CartItem[];
  wishlist: Product[];
  orders: Order[];
  recentlyBought: Product[];

  user: User | null;
  authStatus: AuthStatus;
  authLoading: boolean;
  isAuthenticated: boolean;
  isPrimaryAdmin: boolean;

  storeSettings: {
    storeName: string;
    supportEmail: string;
    shippingThreshold: number;
    shippingCost: number;
    announcementBar: { text: string; isActive: boolean; link: string };
    launchModal: {
      isActive: boolean;
      badge: string;
      title: string;
      description: string;
      ctaLabel: string;
      ctaLink: string;
      image: string;
    };
    maintenanceMode: boolean;
    maintenanceMessage: string;
    bestSellerPids: string[];
    reviewSkinTypeTaggingEnabled: boolean;
    reviewBeforeAfterPhotosEnabled: boolean;
    reviewVerifiedBadgeEnabled: boolean;
    reviewIncentiveEnabled: boolean;
    reviewIncentiveDiscountPercent: number;
    reviewModerationEnabled: boolean;
  };

  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  toggleChat: () => void;

  cartLoading: boolean;

  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  triggerPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;

  getAuthHeaders: () => Promise<HeadersInit>;

  navigateTo: (page: Page, pid?: string, orderId?: string) => void;
  setShopFilter: (f: 'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup' | 'other') => void;
  fetchProducts: (query?: string) => Promise<void>;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (pid: string) => void;
  updateQuantity: (pid: string, qty: number) => void;

  checkout: (shippingDetails: ShippingDetails) => Promise<{ order: Order }>;
  initRazorpayOrder: (items: { productId: string; quantity: number }[], shippingDetails: ShippingDetails) => Promise<{ razorpayOrder: any; calculatedAmount: number }>;
  verifyPayment: (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string, items: { productId: string; quantity: number }[], shippingDetails: ShippingDetails) => Promise<Order>;

  cancelOrder: (orderId: string) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  requestReturn: (orderId: string, reason: string) => Promise<Order>;
  updateOrderAddress: (orderId: string, address: Partial<ShippingDetails>) => Promise<Order>;

  addAddress: (address: Omit<Address, '_id'>) => Promise<void>;
  updateAddress: (addressId: string, address: Partial<Address>) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  setDefaultAddress: (addressId: string) => Promise<void>;

  toggleWishlist: (product: Product) => void;
  isInWishlist: (pid: string) => boolean;

  cartCount: number;
  cartTotal: number;

  refreshProfile: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;
const USER_BASE = `${API_BASE}/user`;
const CART_STORAGE_KEY = 'bodilicious_guest_cart';

const ENFORCEMENT_DATE = new Date("2026-05-31T00:00:00Z").getTime();

/* ================================
   Provider
================================ */

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>(null);

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProductPid, setSelectedProductPid] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [shopFilter, setShopFilter] =
    useState<'all' | 'skin' | 'hair' | 'body' | 'lip' | 'makeup' | 'other'>('all');

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentlyBought, setRecentlyBought] = useState<Product[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authLoading, setAuthLoading] = useState(true);
  const posthog = usePostHog();

  const [storeSettings, setStoreSettings] = useState({
    storeName: 'Bodilicious',
    supportEmail: 'bodiliciousnaturalproducts@gmail.com',
    shippingThreshold: 999,
    shippingCost: 99,
    announcementBar: { text: '', isActive: false, link: '' },
    launchModal: {
      isActive: false,
      badge: 'Just Launched',
      title: 'New Collection',
      description: 'Discover our latest additions, crafted with rare botanical extracts.',
      ctaLabel: 'Explore Collection',
      ctaLink: '/shop',
      image: '',
    },
    maintenanceMode: false,
    maintenanceMessage: 'We are currently down for maintenance. Please check back later.',
    bestSellerPids: [] as string[],
    reviewSkinTypeTaggingEnabled: true,
    reviewBeforeAfterPhotosEnabled: true,
    reviewVerifiedBadgeEnabled: true,
    reviewIncentiveEnabled: false,
    reviewIncentiveDiscountPercent: 10,
    reviewModerationEnabled: true,
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);

  // true while the initial cart sync from the backend is in progress
  const [cartLoading, setCartLoading] = useState(true);

  // Ref to hold syncCartToBackend to avoid circular dependency in fetchUserProfileAndSync
  const syncCartToBackendRef = useRef<((cart: CartItem[]) => Promise<void>) | null>(null);

  // Load cart from localStorage on mount (for guest users)
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      } catch (err) {
        console.error('Failed to parse saved cart', err);
      }
    }
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (cartItems.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cartItems]);

  /* =============================
     Auth headers (Memoized)
  ============================== */
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (auth.currentUser) {
      const token = await getIdToken(auth.currentUser);
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }, []);

  /* =============================
     Profile sync
  ============================== */
const fetchUserProfileAndSync = useCallback(async () => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(USER_BASE, { headers });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('Profile fetch failed:', res.status, errorBody);
      throw new Error(`Profile fetch failed: ${res.status}`);
    }

    const { data } = await res.json();

    setWishlist(data?.wishlist ?? []);
    
    // Merge guest cart with backend cart
    const backendCart: CartItem[] = data?.cart ?? [];
    
    setCartItems(prevItems => {
      if (prevItems.length === 0) return backendCart;

      // Create a map for faster lookup and merging
      const mergedMap = new Map<string, CartItem>();

      // Start with backend items (authoritative for existing user data)
      backendCart.forEach(item => {
        if (item.product?.pid) {
          mergedMap.set(item.product.pid, { ...item });
        }
      });

      // Merge local guest items
      let hasChanges = false;
      prevItems.forEach(localItem => {
        if (!localItem.product?.pid) return;

        const existing = mergedMap.get(localItem.product.pid);
        if (existing) {
          // Take the higher quantity rather than summing to prevent accidental
          // doubling when the same item was added both as a guest and while logged in.
          const mergedQty = Math.max(Number(existing.quantity || 0), Number(localItem.quantity || 1));
          if (mergedQty !== existing.quantity) {
            existing.quantity = mergedQty;
            hasChanges = true;
          }
        } else {
          // New item from guest session
          mergedMap.set(localItem.product.pid, { ...localItem });
          hasChanges = true;
        }
      });

      const nextCart = Array.from(mergedMap.values());
      
      // If we added guest items to a logged-in user, sync back to backend immediately
      if (hasChanges && auth.currentUser) {
        setTimeout(() => syncCartToBackendRef.current?.(nextCart), 0);
      }

      return nextCart;
    });

    const validOrders = (data?.orders ?? []).filter((o: any) => o !== null);
    setOrders(validOrders);

    setRecentlyBought(data?.recentlyBought ?? []);

       setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        phone: data?.phone,
        gender: data?.gender,
        dateOfBirth: data?.dateOfBirth,
        skinType: data?.skinType,
        skinConcerns: data?.skinConcerns,
        preferredRoutine: data?.preferredRoutine,
        addresses: data?.addresses ?? [],
        welcomeOffer: data?.welcomeOffer,
        address: data?.address,
        city: data?.city,
        state: data?.state,
        pincode: data?.pincode,
        role: data?.role,
        isBlocked: data?.isBlocked,
      };
    });

    setCartLoading(false);
  } catch (err) {
    console.error('Profile sync failed', err);
    setCartLoading(false);
  }
}, [getAuthHeaders]);

  /* =============================
     Firebase auth listener
  ============================== */

const syncUserState = useCallback(async (firebaseUser: any) => {
  if (!firebaseUser) {
    setUser(null);
    setWishlist([]);
    setCartItems([]);
    setOrders([]);
    setRecentlyBought([]);
    setAuthStatus('unauthenticated');
    setCartLoading(false);
    setAuthLoading(false);
    return;
  }

  try {
    await reload(firebaseUser);
    const refreshedUser = auth.currentUser;

    if (!refreshedUser) {
      setUser(null);
      setAuthStatus('unauthenticated');
      setAuthLoading(false);
      return;
    }

    setUser({
      uid: refreshedUser.uid,
      email: refreshedUser.email,
      displayName: refreshedUser.displayName,
      photoURL: refreshedUser.photoURL,
    });

    await getIdToken(refreshedUser, true);

    const isNewUser = new Date(refreshedUser.metadata.creationTime || 0).getTime() >= ENFORCEMENT_DATE;

    if (!refreshedUser.emailVerified && isNewUser) {
      setAuthStatus('awaiting-verification');
      setCartLoading(false);
    } else {
      setAuthStatus('authenticated');
      await fetchUserProfileAndSync();
    }
  } catch (err) {
    console.error('Auth state sync failed:', err);
    setUser(null);
    setAuthStatus('unauthenticated');
    setCartLoading(false);
  } finally {
    setAuthLoading(false);
  }
}, [fetchUserProfileAndSync]);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      await syncUserState(firebaseUser);
    });

    return () => unsub();
  }, [syncUserState]);

const refreshAuthState = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    setUser(null);
    setAuthStatus('unauthenticated');
    return;
  }

  await reload(currentUser);
  await getIdToken(currentUser, true);

  const refreshedUser = auth.currentUser;

  if (!refreshedUser) {
    setUser(null);
    setAuthStatus('unauthenticated');
    return;
  }

  setUser({
    uid: refreshedUser.uid,
    email: refreshedUser.email,
    displayName: refreshedUser.displayName,
    photoURL: refreshedUser.photoURL,
  });

  const isNewUser = new Date(refreshedUser.metadata.creationTime || 0).getTime() >= ENFORCEMENT_DATE;

  if (!refreshedUser.emailVerified && isNewUser) {
    setAuthStatus('awaiting-verification');
  } else {
    setAuthStatus('authenticated');
    await fetchUserProfileAndSync();
  }
};

  /* =============================
     Auth actions
  ============================== */
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    await refreshAuthState();
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await refreshAuthState();
  };

const signUpWithEmail = async (email: string, password: string, name: string) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });

      const headers = await getAuthHeaders();
      await fetch(`${USER_BASE}/send-verification`, {
        method: "POST",
        headers,
      });
    }

    await refreshAuthState();
  } catch (err: any) {
    console.error("Signup failed:", err);
    throw err;
  }
};

const resendVerificationEmail = async () => {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${USER_BASE}/send-verification`, {
      method: "POST",
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Failed to send verification email");
    }

    console.log("Verification email sent");
  } catch (err) {
    console.error("Resend verification failed:", err);
    throw err;
  }
};

const triggerPasswordReset = async (email: string) => {
  try {
    const res = await fetch(`${USER_BASE}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to trigger password reset");
    }
  } catch (err) {
    console.error("Forgot password failed:", err);
    throw err;
  }
};

  const logout = async () => {
    // Clear local state synchronously before Firebase signOut so the UI never
    // briefly renders stale user data while onAuthStateChanged propagates.
    setUser(null);
    setCartItems([]);
    setOrders([]);
    setWishlist([]);
    setRecentlyBought([]);
    setAuthStatus('unauthenticated');
    await signOut(auth);
    navigateTo('home');
  };

  const updateUserProfile = async (updateData: Partial<User>) => {
    if (authStatus !== 'authenticated') return;

    const headers = await getAuthHeaders();
    const res = await fetch(USER_BASE, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      throw new Error('Failed to update profile');
    }

    const { data } = await res.json();
    setUser(prev => (prev ? { ...prev, ...data } : null));
  };

  /* =============================
     Products
  ============================== */
  const fetchProducts = useCallback(async (query: string = '') => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/products`;
      if (query) {
        url += query.startsWith('?') ? query : `?${query}`;
      }

      // Default limit to 50 for performance if not specified
      if (!url.includes('limit=')) {
        url += (url.includes('?') ? '&' : '?') + 'limit=50';
      }

      const res = await fetch(url);
      const json = await res.json();
      setProducts(json?.data ?? []);
      setTotalProducts(json?.total ?? 0);
    } catch (err) {
      console.error(err);
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFilters = useCallback(async () => {
    // Deduplicate: Don't fetch if we already have filters
    if (filters) return;
    
    try {
      const res = await fetch(`${API_BASE}/products/filters`);
      const json = await res.json();
      if (json.success) setFilters(json.data);
    } catch (err) {
      console.error('Failed to fetch filters', err);
    }
  }, [filters]);

  const fetchSettings = useCallback(async () => {
    try {
      const bypassToken = localStorage.getItem('maintenance_bypass');
      const query = bypassToken ? `?bypass=${bypassToken}` : '';
      const res = await fetch(`${API_BASE}/settings/public${query}`);
      const json = await res.json();
      if (json.success && json.data) {
        setStoreSettings(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch store settings', err);
    }
  }, []);

  // Sync products with URL query and fetch filters once
  useEffect(() => {
    fetchFilters();
    fetchSettings();
  }, [fetchFilters, fetchSettings]);

  // Route-aware product fetch: only runs on pages that actually render products.
  // Explicit equality checks prevent '/' matching every route via startsWith.
  useEffect(() => {
    const pathname = location.pathname;

    const isProductRoute = 
      pathname === '/' ||
      pathname === '/shop' ||
      pathname === '/ritual-finder' ||
      pathname.startsWith('/product');

    if (!isProductRoute) return;

    // 150ms debounce absorbs rapid search-param churn from the shop filter UI.
    const timeout = setTimeout(() => {
      fetchProducts(location.search);
    }, 150);

    return () => clearTimeout(timeout);
  }, [fetchProducts, location.pathname, location.search]);

  /* =============================
     Navigation
  ============================== */
  useEffect(() => {
    const path = location.pathname.substring(1) || 'home';
    setCurrentPage(path as Page);
  }, [location.pathname]);

  const navigateTo = (page: Page, pid?: string, orderId?: string) => {
    setCurrentPage(page);
    setSelectedProductPid(pid ?? null);
    setSelectedOrderId(orderId ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'home') navigate('/');
    else if (page === 'product' && pid) navigate(`/product/${pid}`);
    else if (page === 'order-details' && orderId) navigate(`/orders/${orderId}`);
    else navigate(`/${page}`);
  };

  /* =============================
     Helpers: resolve productId
     (prevents checkout 400 when cart items miss _id)
  ============================== */
  const resolveProductId = useCallback(
    (p: Product): string | null => {
      const anyP = p as any;
      if (anyP?._id) return String(anyP._id);

      const match = products.find(x => x.pid === p.pid) as any;
      if (match?._id) return String(match._id);

      return null;
    },
    [products]
  );

  /* =============================
     Cart helpers
  ============================== */
  const syncCartToBackend = useCallback(async (newCart: CartItem[]) => {
    if (authStatus !== 'authenticated') return;

    const headers = await getAuthHeaders();

    await fetch(`${USER_BASE}/cart`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cartItems: newCart
          .filter(i => i.product)
          .map(i => {
            const productId = resolveProductId(i.product);
            return productId ? { productId, pid: i.product.pid, quantity: i.quantity } : null;
          })
          .filter(Boolean),
      }),
    });
  }, [authStatus, getAuthHeaders, resolveProductId]);

  // Keep the ref always pointing to the latest syncCartToBackend
  useEffect(() => {
    syncCartToBackendRef.current = syncCartToBackend;
  }, [syncCartToBackend]);

  const addToCart = (product: Product, quantity: number = 1) => {
    if (!product) return;

    setCartItems(prev => {
      let isMutated = false;
      const newItems = prev.map(i => {
        if (i.product && i.product.pid === product.pid) {
          isMutated = true;
          return { ...i, quantity: Number(i.quantity ?? 0) + Number(quantity) };
        }
        return i;
      });

      if (!isMutated) {
        newItems.push({ product, quantity });
      }

      // Sync inside the updater so `newItems` is always the authoritative
      // computed value — avoids stale-closure race conditions.
      setTimeout(() => syncCartToBackend(newItems), 0);
      return newItems;
    });

    // 🚀 PostHog Client-Side Tracking
    if (posthog) {
      posthog.capture('Added to Cart', {
        productId: product.pid,
        name: product.name,
        price: product.price,
        quantity: quantity
      });
    }

    // 🚀 Internal Analytics Tracking
    getAuthHeaders().then(headers => {
      fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/analytics/track`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'cart_item_added',
          productId: product.pid,
          productName: product.name
        })
      }).catch(() => {});
    });
  };

  const removeFromCart = (pid: string) => {
    setCartItems(prev => {
      const nextCart = prev.filter(i => i.product && i.product.pid !== pid);
      setTimeout(() => syncCartToBackend(nextCart), 0);
      return nextCart;
    });
  };

  const updateQuantity = (pid: string, qty: number) => {
    setCartItems(prev => {
      const nextCart = prev.map(i =>
        i.product && i.product.pid === pid ? { ...i, quantity: Number(qty) } : i
      );
      setTimeout(() => syncCartToBackend(nextCart), 0);
      return nextCart;
    });
  };

  /* =============================
     Checkout (COD only)
  ============================== */
  const checkout = async (
    shippingDetails: ShippingDetails
  ): Promise<{ order: Order }> => {
    if (authStatus !== 'authenticated') throw new Error('Please sign in to checkout');
    if (cartItems.length === 0) throw new Error('Your cart is empty');

    if (!shippingDetails?.name || !shippingDetails?.phone || !shippingDetails?.address ||
      !shippingDetails?.city || !shippingDetails?.state || !shippingDetails?.pincode) {
      throw new Error('Please fill all required shipping details.');
    }

    const headers = await getAuthHeaders();
    const items = cartItems
      .filter(i => i.product)
      .map(i => {
        const productId = resolveProductId(i.product);
        return productId ? { productId, pid: i.product.pid, quantity: i.quantity } : null;
      })
      .filter(Boolean) as { productId: string; quantity: number }[];

    if (items.length === 0) throw new Error('Cart items are missing product IDs. Refresh and add again.');

    const utmStorage = localStorage.getItem('bodilicious_utm');
    const marketing = utmStorage ? JSON.parse(utmStorage) : undefined;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items, shippingDetails, paymentMethod: 'cod', marketing }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || 'Failed to checkout');
    }

    const json = await response.json();
    const { order } = json.data;

    // Cart was cleared server-side; clear locally immediately
    // (must be synchronous before navigate() fires, otherwise useEffect
    //  persist runs after navigation and localStorage keeps stale cart)
    setCartItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    setOrders(prev => [order, ...prev]);

    // Clear UTM tracking after successful checkout
    localStorage.removeItem('bodilicious_utm');

    return { order };
  };

  /* =============================
     Init Razorpay Order (no DB record created)
  ============================== */
  const initRazorpayOrder = async (
    items: { productId: string; quantity: number }[],
    shippingDetails: ShippingDetails
  ): Promise<{ razorpayOrder: any; calculatedAmount: number }> => {
    if (authStatus !== 'authenticated') throw new Error('Please sign in');

    const headers = await getAuthHeaders();
    // Include UTM marketing attribution — same as COD checkout does
    const utmStorage = localStorage.getItem('bodilicious_utm');
    const marketing = utmStorage ? JSON.parse(utmStorage) : undefined;

    const res = await fetch(`${API_BASE}/payment/razorpay/init`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items, shippingDetails, marketing }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Failed to initialize payment');
    }

    const json = await res.json();
    return json.data;
  };

  /* =============================
     Verify Payment & Create Order
  ============================== */
  const verifyPayment = async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    items: { productId: string; quantity: number }[],
    shippingDetails: ShippingDetails
  ): Promise<Order> => {
    const headers = await getAuthHeaders();
    const utmStorage = localStorage.getItem('bodilicious_utm');
    const marketing = utmStorage ? JSON.parse(utmStorage) : undefined;

    const res = await fetch(`${API_BASE}/payment/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        items,
        shippingDetails,
        marketing,
      }),
    });

    // ── 202: Payment captured but order creation failed after all retries ──────
    // The backend tried 3 times with exponential backoff. The money IS taken.
    // The Razorpay webhook (payment.captured) will still process the order async.
    // Throw a TYPED error so PaymentPage shows a proper screen — not just a toast.
    if (res.status === 202) {
      const body = await res.json().catch(() => ({}));
      // Clear cart locally — customer HAS paid, their cart is gone server-side
      setCartItems([]);
      localStorage.removeItem('bodilicious_utm');
      const err: any = new Error(body.message || 'Payment captured, order pending');
      err.paymentCaptured = true;
      err.razorpayPaymentId = body.razorpay_payment_id || razorpay_payment_id;
      err.orderId = body.orderId;
      throw err;
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.message || 'Payment verification failed');
    }

    const { data: order } = await res.json();

    // Cart was cleared server-side; clear locally immediately
    // (must be synchronous before navigate() fires)
    setCartItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);

    // Deduplicate: only prepend if this order is not already in state
    // (prevents double-entry when verifyPayment returns an already-processed order)
    setOrders(prev => {
      const alreadyExists = prev.some(o => (o as any)._id === (order as any)._id);
      if (alreadyExists) {
        // Update in place with latest data
        return prev.map(o => (o as any)._id === (order as any)._id ? order : o);
      }
      return [order, ...prev];
    });

    // Clear UTM tracking after successful checkout
    localStorage.removeItem('bodilicious_utm');

    return order;
  };

  /* =============================
     Orders
  ============================== */
  const cancelOrder = async (orderId: string) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'PATCH',
      headers,
    });
    if (!res.ok) throw new Error('Failed to cancel order');

    setOrders(prev =>
      prev.map(o => (o as any)._id === orderId ? { ...(o as any), orderStatus: 'cancelled' } : o)
    );
    };

    const requestReturn = async (orderId: string, reason: string): Promise<Order> => {
        if (authStatus !== 'authenticated') {
            throw new Error('Unauthenticated');
        }
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/orders/${orderId}/return`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ reason }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to submit return request');
        }

        const { data } = await res.json();
        setOrders(prev => prev.map(o => ((o as any)._id === orderId ? data : o)));
        return data;
    };

    const deleteOrder = async (orderId: string) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete order');

    setOrders(prev => prev.filter(o => (o as any)._id !== orderId));
  };


  const updateOrderAddress = async (
    orderId: string,
    address: Partial<ShippingDetails>
  ): Promise<Order> => {
    if (authStatus !== 'authenticated') {
      throw new Error('Unauthenticated');
    }
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/orders/${orderId}/address`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(address),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update address');
    }

    const { data } = await res.json();
    setOrders(prev => prev.map(o => ((o as any)._id === orderId ? data : o)));
    return data;
  };

  /* =============================
     Address Management
  ============================== */
  const addAddress = async (address: Omit<Address, '_id'>) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${USER_BASE}/address`, {
      method: 'POST',
      headers,
      body: JSON.stringify(address),
    });
    if (!res.ok) throw new Error('Failed to add address');
    const { data } = await res.json();
    setUser(prev => (prev ? { ...prev, addresses: data } : null));
  };

  const updateAddress = async (addressId: string, address: Partial<Address>) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${USER_BASE}/address/${addressId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(address),
    });
    if (!res.ok) throw new Error('Failed to update address');
    const { data } = await res.json();
    setUser(prev => (prev ? { ...prev, addresses: data } : null));
  };

  const deleteAddress = async (addressId: string) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${USER_BASE}/address/${addressId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete address');
    const { data } = await res.json();
    setUser(prev => (prev ? { ...prev, addresses: data } : null));
  };

  const setDefaultAddress = async (addressId: string) => {
    if (authStatus !== 'authenticated') return;
    const headers = await getAuthHeaders();
    const res = await fetch(`${USER_BASE}/address/${addressId}/default`, {
      method: 'PATCH',
      headers,
    });
    if (!res.ok) throw new Error('Failed to set default address');
    const { data } = await res.json();
    setUser(prev => (prev ? { ...prev, addresses: data } : null));
  };

  /* =============================
     Wishlist
  ============================== */
  const toggleWishlist = async (product: Product) => {
    const exists = wishlist.some(p => p.pid === product.pid);
    const pWithId = product as Product & { _id?: string };

    setWishlist(prev => (exists ? prev.filter(p => p.pid !== product.pid) : [...prev, product]));

    if (authStatus === 'authenticated') {
      const headers = await getAuthHeaders();

      const productId = pWithId._id || resolveProductId(product);

      // If we still don't have productId, skip backend sync (but keep local wishlist)
      if (!productId) return;

      await fetch(exists ? `${USER_BASE}/wishlist/${productId}` : `${USER_BASE}/wishlist`, {
        method: exists ? 'DELETE' : 'POST',
        headers,
        body: exists ? undefined : JSON.stringify({ productId }),
      });
    }
  };

  const isInWishlist = (pid: string) => wishlist.some(p => p.pid === pid);

  /* =============================
     Derived values
  ============================== */
  const cartCount = cartItems.reduce(
    (sum, i) => sum + (i.product ? Number(i.quantity ?? 0) : 0),
    0
  );

  const cartTotal = cartItems.reduce((sum, i) => {
    if (!i.product) return sum;
    const qty = Number(i.quantity ?? 0);
    const price = Number((i.product as any).price ?? 0);
    return sum + price * qty;
  }, 0);

  return (
    <AppContext.Provider
      value={{
        products,
        totalProducts,
        isLoading,
        error,
        filters,
        currentPage,
        selectedProductPid,
        selectedOrderId,
        shopFilter,
        cartItems,
        wishlist,
        orders,
        recentlyBought,
        user,
        authStatus,
        authLoading,
        isAuthenticated: !!user && authStatus === 'authenticated',
        isPrimaryAdmin: user?.role === 'primary_admin',
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        triggerPasswordReset,
        logout,
        refreshAuthState,
        updateUserProfile,
        getAuthHeaders,
        navigateTo,
        setShopFilter,
        fetchProducts,
        addToCart,
        removeFromCart,
        updateQuantity,
        checkout,
        initRazorpayOrder,
        verifyPayment,
        cancelOrder,
        deleteOrder,
        requestReturn,
        updateOrderAddress,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        toggleWishlist,
        isInWishlist,
        cartCount,
        cartTotal,
        isChatOpen,
        setIsChatOpen,
        toggleChat,
        cartLoading,
        refreshProfile: fetchUserProfileAndSync,
        storeSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/* ================================
   Hook
================================ */
// The hook is kept here for backward compatibility with the 40+ files that
// import from this module. New code should import from `./useApp` instead,
// which isolates the hook in its own file and satisfies the
// react-refresh/only-export-components HMR rule.
// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}