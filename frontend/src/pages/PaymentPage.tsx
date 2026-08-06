
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Check, ShieldCheck, ChevronRight, Loader2, AlertTriangle, Clock } from 'lucide-react';
import Footer from '../components/Footer';
import RequireAuth from '../components/RequireAuth';
import toast from 'react-hot-toast';
import { CartItem } from '../types';
import { COUNTRIES } from '../utils/countries';
import { formatCurrency } from '../utils/currencies';
import { useCurrency } from '../hooks/useCurrency';
import { useSEO } from '../hooks/useSEO';

// ─── Checkout session timeout constants ──────────────────────────────────────
// ⚠️ TEST VALUES — restore for production:
//   SESSION_DURATION_MS = 10 * 60 * 1000  (10 min)
//   WARN_AT_SECS        = 3 * 60           (3 min)
//   URGENT_AT_SECS      = 60               (1 min)
const SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const WARN_AT_SECS = 3 * 60;               // show banner at 3 minutes remaining
const URGENT_AT_SECS = 60;                 // turn red at 1 minute remaining

type BillingForm = {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
};

// ─── Razorpay script loader (idempotent) ─────────────────────────────────────
const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) { resolve(true); return; }
        
        // 10 second timeout max for loading script
        const timeout = setTimeout(() => {
            resolve(!!(window as any).Razorpay);
        }, 10000);

        const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
        if (existing) {
            existing.addEventListener('load', () => { clearTimeout(timeout); resolve(!!(window as any).Razorpay); });
            existing.addEventListener('error', () => { clearTimeout(timeout); resolve(false); });
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => { clearTimeout(timeout); resolve(!!(window as any).Razorpay); };
        script.onerror = () => { clearTimeout(timeout); resolve(false); };
        document.body.appendChild(script);
    });
};

// ─── Verify timeout (ms) — after this we tell user to check account ──────────
const VERIFY_TIMEOUT_MS = 25_000;

// ─── Processing overlay states ────────────────────────────────────────────────
type OverlayState = 'none' | 'init' | 'verifying' | 'success' | 'timeout' | 'captured_failed' | 'cod_processing';

export default function PaymentPage() {
    useSEO({
        title: 'Secure Checkout - Payment',
        description: 'Complete your secure checkout.',
        noIndex: true
    });

    const { cartItems, cartTotal, checkout, initRazorpayOrder, verifyPayment, user, products, storeSettings, cartLoading, fetchShippingQuote, appliedCoupon } = useApp();
    const { formatPrice, userCurrency } = useCurrency();
    const location = useLocation();
    const navigate = useNavigate();

    const [quoteData, setQuoteData] = useState<{ quoteId: string, shippingCost: number, total: number, deliveryEstimate: string, currency: string, isFallback: boolean, subtotal?: number, taxAmount?: number, taxRatePercent?: number } | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(true);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    // Rate-limit countdown: seconds remaining until retry is allowed (null = not rate-limited)
    const [rateLimitSecs, setRateLimitSecs] = useState<number | null>(null);
    const rateLimitTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [paymentMethod, setPaymentMethod] = useState('card');
    // isProcessing = button spinner (init phase only)
    const [isProcessing, setIsProcessing] = useState(false);
    // overlay = full-screen lock once Razorpay handler fires
    const [overlay, setOverlay] = useState<OverlayState>('none');
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
    const shippingDetails = location.state?.shippingDetails;

    const [billingDetails, setBillingDetails] = useState<BillingForm>({
        name: shippingDetails?.name || '',
        address: shippingDetails?.address || '',
        city: shippingDetails?.city || '',
        state: shippingDetails?.state || '',
        pincode: shippingDetails?.pincode || '',
        country: shippingDetails?.country || 'India'
    });
    const [billingTouched, setBillingTouched] = useState<Record<string, boolean>>({});

    const razorpayInstanceRef = useRef<any>(null);
    // COD double-submit guard
    const submittingRef = useRef(false);
    // Verify timeout timer
    const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Razorpay payment ID stored when overlay='captured_failed' so the UI can display it
    const [capturedPaymentId, setCapturedPaymentId] = useState<string | null>(null);
    // True while the Razorpay modal is open — keeps isLocked=true so tab-close is blocked
    const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);

    // isLocked must be declared early so the session timer hooks below can read it via a ref
    const isLocked = isProcessing || overlay !== 'none' || razorpayModalOpen;
    // Keep a ref so intervals always read the latest value without stale closure issues
    const isLockedRef = useRef(isLocked);
    useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

    // ── Checkout session timer ────────────────────────────────────────────────
    // secsRemaining=null → timer not yet started / hidden
    const [secsRemaining, setSecsRemaining] = useState<number | null>(null);
    const sessionEndRef = useRef<number | null>(null);
    const sessionTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startOrResetSessionTimer = useCallback(() => {
        sessionEndRef.current = Date.now() + SESSION_DURATION_MS;
        // Don't show the banner yet — only reveal once we're in the warning zone
        setSecsRemaining(null);
    }, []);

    // Kick off the timer once the page is ready (quote loaded)
    useEffect(() => {
        if (quoteLoading || !shippingDetails) return;
        startOrResetSessionTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteLoading]);

    // Tick every second — starts once the quote is loaded (sessionEndRef populated)
    useEffect(() => {
        // Don't start the tick until the session timer has been kicked off
        if (quoteLoading || !shippingDetails) return;

        if (sessionTickRef.current) clearInterval(sessionTickRef.current);

        sessionTickRef.current = setInterval(() => {
            // Pause countdown while payment is in progress
            if (isLockedRef.current) return;
            // Guard in case sessionEndRef hasn't been set yet
            if (!sessionEndRef.current) return;

            const remaining = Math.max(0, Math.floor((sessionEndRef.current - Date.now()) / 1000));

            if (remaining <= WARN_AT_SECS) {
                setSecsRemaining(remaining);
            }

            if (remaining === 0) {
                if (sessionTickRef.current) clearInterval(sessionTickRef.current);
                toast.error('Your checkout session expired. Please review your cart and try again.', {
                    id: 'session-expired',
                    duration: 6000,
                });
                navigate('/cart', { replace: true });
            }
        }, 1000);

        return () => {
            if (sessionTickRef.current) clearInterval(sessionTickRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteLoading, shippingDetails, navigate]);

    // Reset timer on user activity (only while not locked)
    useEffect(() => {
        if (quoteLoading || !shippingDetails) return;
        const handleActivity = () => {
            if (!isLockedRef.current && sessionEndRef.current) {
                startOrResetSessionTimer();
            }
        };
        window.addEventListener('click', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('scroll', handleActivity, { passive: true });
        return () => {
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, [isLocked, quoteLoading, shippingDetails, startOrResetSessionTimer]);

    // Helper to format seconds as M:SS
    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };


    const validCartItems = cartItems.filter((item: CartItem) => item && item.product);

    // ── Build items payload ───────────────────────────────────────────────────
    const buildItemsPayload = useCallback(() => {
        return validCartItems
            .map((item: CartItem) => {
                const anyP = item.product as any;
                let productId = anyP?._id ? String(anyP._id) : null;
                if (!productId) {
                    const match = products.find((x: any) => x.pid === item.product.pid) as any;
                    if (match?._id) productId = String(match._id);
                }
                return productId ? { productId, pid: item.product.pid, quantity: item.quantity } : null;
            })
            .filter(Boolean) as { productId: string; quantity: number }[];
    }, [validCartItems, products]);

    // ── Redirect if no shipping details ──────────────────────────────────────
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!shippingDetails) navigate('/cart', { replace: true });
    }, [shippingDetails, navigate]);

    // ── Fetch Quote on Mount & Visibility Change ─────────────────────────────
    // Track when the last quote was successfully fetched so the visibility-change
    // handler can enforce a cooldown and not hammer the endpoint on rapid tab switches.
    const lastQuoteFetchRef = useRef<number>(0);
    const QUOTE_REFRESH_COOLDOWN_MS = 60_000; // at most once per minute on tab focus

    useEffect(() => {
        if (!shippingDetails || cartLoading) return;
        if (validCartItems.length === 0 && !submittingRef.current && overlay !== 'success' && overlay !== 'cod_processing') {
            navigate('/cart', { replace: true });
            return;
        }

        let isMounted = true;
        let isFetching = false;
        
        const fetchQuote = async (isBackgroundRefresh = false) => {
            // isLockedRef is used here (not isLocked) to avoid adding isLocked to deps
            // which would cause this whole effect — and another quote fetch — to re-run
            // every time the Razorpay modal opens or overlay state changes.
            if (isFetching || isLockedRef.current) return;
            isFetching = true;
            try {
                // Use buildItemsPayload to properly resolve product IDs using the products list
                const itemsForQuote = buildItemsPayload();
                const data = await fetchShippingQuote(itemsForQuote, shippingDetails, appliedCoupon || undefined);
                
                if (isMounted) {
                    setRateLimitSecs(null);
                    setQuoteError(null);
                    if (rateLimitTickRef.current) clearInterval(rateLimitTickRef.current);
                    lastQuoteFetchRef.current = Date.now();
                    setQuoteData({
                        quoteId: data.quoteId,
                        shippingCost: data.shippingCost,
                        total: data.totalAmount || data.total,
                        deliveryEstimate: data.deliveryEstimate,
                        currency: data.currency || 'INR',
                        isFallback: !!data.isFallback,
                        subtotal: data.subtotal,
                        taxAmount: data.taxAmount,
                        taxRatePercent: data.taxRatePercent
                    });
                    if (isBackgroundRefresh) {
                        toast.success("Prices refreshed", { id: 'quote-refresh' });
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    if (err.isRateLimit) {
                        // Show countdown and auto-retry when it hits zero
                        const totalSecs = Math.ceil((err.retryAfterMs || 60000) / 1000);
                        setRateLimitSecs(totalSecs);
                        setQuoteError(null);
                        if (rateLimitTickRef.current) clearInterval(rateLimitTickRef.current);
                        rateLimitTickRef.current = setInterval(() => {
                            setRateLimitSecs(prev => {
                                if (prev === null || prev <= 1) {
                                    clearInterval(rateLimitTickRef.current!);
                                    fetchQuote(true); // Retry silently
                                    return null;
                                }
                                return prev - 1;
                            });
                        }, 1000);
                    } else {
                        const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
                        toast.error(isTimeout ? 'Server is taking too long to respond. Please check your connection.' : 'Session expired — please review your cart.');
                        navigate('/cart', { replace: true });
                    }
                }
            } finally {
                if (isMounted) {
                    setQuoteLoading(false);
                    isFetching = false;
                }
            }
        };

        // Initial fetch
        fetchQuote();

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                // Enforce cooldown: don't re-fetch if a quote was fetched recently
                const sinceLastFetch = Date.now() - lastQuoteFetchRef.current;
                if (sinceLastFetch < QUOTE_REFRESH_COOLDOWN_MS) return;
                fetchQuote(true);
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted = false;
            if (rateLimitTickRef.current) clearInterval(rateLimitTickRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        
    // isLocked intentionally excluded — use isLockedRef inside instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shippingDetails, navigate, cartLoading, validCartItems.length, fetchShippingQuote, buildItemsPayload, userCurrency, appliedCoupon]);

    // ── Pre-load Razorpay on mount ────────────────────────────────────────────
    useEffect(() => {
        loadRazorpayScript();
    }, []);

    // ── Block browser back/close during any processing ────────────────────────
    useEffect(() => {
        if (!isLocked) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Payment is being processed. Please do not leave this page.';
            return e.returnValue;
        };

        // Block the back button
        const handlePopState = () => {
            if (isLocked) {
                // Push state back to prevent navigation
                window.history.pushState(null, '', window.location.href);
                toast.error('Please wait — your payment is being processed.', { id: 'nav-block' });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isLocked]);

    // ── Cleanup timer on unmount ──────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
        };
    }, []);

    if (!shippingDetails || quoteLoading) return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
            <p className="text-xs uppercase tracking-widest font-sans text-dark-red">Calculating final total…</p>
        </div>
    );

    const shippingCost = quoteData?.shippingCost ?? storeSettings.shippingCost;
    const total = quoteData?.total ?? (cartTotal + shippingCost);


    // ── Billing validation logic ──────────────────────────────────────────────
    const isIndiaCountry = (c: string) => ['india', 'in', 'bharat', 'ind'].includes((c || '').toLowerCase().trim());

    // ── COD availability ──────────────────────────────────────────────────────
    // Mirrors the server-side gate in tracker/controller.js → createOrder, so the UI
    // never offers an option the backend will reject. The server remains the authority;
    // this only avoids a dead-end at submit time.
    const isDomesticOrder = isIndiaCountry(shippingDetails.country);
    const codAvailable =
        storeSettings.codEnabled !== false &&
        (isDomesticOrder || !!storeSettings.codInternationalEnabled);
    const codUnavailableReason = codAvailable
        ? null
        : storeSettings.codEnabled === false
            ? 'Cash on Delivery is currently unavailable'
            : 'Not available for international shipping';


    const billingErrors: Partial<BillingForm> = {};
    if (billingTouched.name && !billingDetails.name.trim()) billingErrors.name = 'Name is required.';
    if (billingTouched.address && !billingDetails.address.trim()) billingErrors.address = 'Address is required.';
    if (billingTouched.city && !billingDetails.city.trim()) billingErrors.city = 'City is required.';
    if (billingTouched.state && !billingDetails.state.trim()) billingErrors.state = 'State is required.';
    if (billingTouched.pincode) {
        if (!billingDetails.pincode.trim()) billingErrors.pincode = 'Postal code is required.';
        else if (isIndiaCountry(billingDetails.country) && !/^\d{6}$/.test(billingDetails.pincode))
            billingErrors.pincode = 'Invalid 6-digit Indian PIN code.';
    }

    const isBillingValid = billingSameAsShipping || (
        (!isIndiaCountry(billingDetails.country) || /^\d{6}$/.test(billingDetails.pincode)) &&
        (['name', 'address', 'city', 'state', 'pincode', 'country'] as (keyof BillingForm)[]).every(k => billingDetails[k].trim().length > 0)
    );

    const touchBilling = (field: keyof BillingForm) => setBillingTouched(prev => ({ ...prev, [field]: true }));
    const fieldCls = (f: keyof BillingForm) => 
        `w-full px-4 py-3 bg-white border outline-none transition-colors font-sans text-sm rounded-sm ${
            billingErrors[f] ? 'border-red-500 focus:border-red-500' : 'border-silk focus:border-dark-red text-gray-900'
        }`;

    // ── Main submit handler ───────────────────────────────────────────────────
    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        // Hard guard: never allow double-submit
        if (submittingRef.current || isLocked) return;
        submittingRef.current = true;
        setIsProcessing(true);

        try {
            if (!billingSameAsShipping) {
                setBillingTouched({ name: true, address: true, city: true, state: true, pincode: true, country: true });
                if (!isBillingValid) {
                    toast.error('Please complete the billing address properly.');
                    submittingRef.current = false;
                    setIsProcessing(false);
                    return;
                }
            }
            
            const finalBillingDetails = billingSameAsShipping ? null : billingDetails;

            if (paymentMethod === 'cod') {
                // Defensive: the radio is disabled when COD is unavailable, but settings
                // can change between page load and submit. Fail here with a clear message
                // rather than letting the server reject the order.
                if (!codAvailable) {
                    toast.error(codUnavailableReason || 'Cash on Delivery is not available for this order.');
                    submittingRef.current = false;
                    setIsProcessing(false);
                    return;
                }
                setOverlay('cod_processing');
                try {
                    const { order } = await checkout(shippingDetails, finalBillingDetails as any, appliedCoupon || undefined);
                    navigate('/confirmation', { state: { orderId: order._id, status: 'success' }, replace: true });
                } finally {
                    // Always reset guard so user can retry if navigation or confirmation throws
                    submittingRef.current = false;
                }

            } else {
                // ── 1. Ensure Razorpay SDK is available ──────────────────────
                setOverlay('init');
                if (!(window as any).Razorpay) {
                    const ok = await loadRazorpayScript();
                    if (!ok || !(window as any).Razorpay) {
                        setOverlay('none');
                        throw new Error('Payment gateway failed to load. Please refresh the page and try again.');
                    }
                }

                // ── 2. Create draft order on backend ─────────────────────────
                const items = buildItemsPayload();
                if (items.length === 0) {
                    throw new Error('Cart items are missing product IDs. Please go back to cart and try again.');
                }

                setOverlay('init');
                const { razorpayOrder } = await initRazorpayOrder(items, shippingDetails, finalBillingDetails as any, quoteData?.quoteId, appliedCoupon || undefined);
                setIsProcessing(false); // spinner → overlay takes over

                const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
                if (!razorpayKey) throw new Error('Payment configuration error. Please contact support.');

                // ── 3. Open Razorpay modal ────────────────────────────────────
                const options: any = {
                    key: razorpayKey,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    name: 'Bodilicious',
                    description: 'Premium Beauty',
                    order_id: razorpayOrder.id,

                    handler: async function (response: any) {
                        // ── Payment captured by Razorpay ──────────────────────
                        // Show full-screen verifying overlay immediately — nothing is clickable
                        setOverlay('verifying');

                        // Start a safety timeout in case verify hangs
                        verifyTimerRef.current = setTimeout(() => {
                            setOverlay('timeout');
                        }, VERIFY_TIMEOUT_MS);

                        try {
                            const order = await verifyPayment(
                                response.razorpay_order_id,
                                response.razorpay_payment_id,
                                response.razorpay_signature,
                                items,
                                shippingDetails
                            );

                            if (verifyTimerRef.current) {
                                clearTimeout(verifyTimerRef.current);
                                verifyTimerRef.current = null;
                            }
                            setRazorpayModalOpen(false);
                            setOverlay('success');

                            // Short success flash then navigate
                            setTimeout(() => {
                                navigate('/confirmation', {
                                    state: { orderId: order._id, status: 'success' },
                                    replace: true
                                });
                            }, 800);

                        } catch (err: any) {
                            if (verifyTimerRef.current) {
                                clearTimeout(verifyTimerRef.current);
                                verifyTimerRef.current = null;
                            }
                            setRazorpayModalOpen(false);

                            // ── Payment captured but order creation failed ──────────
                            // The backend retried 3 times and gave up. It returned 202
                            // with paymentCaptured=true. Show a permanent overlay instead
                            // of a dismissible toast — money was taken, this is critical.
                            if (err?.paymentCaptured) {
                                setCapturedPaymentId(err.razorpayPaymentId || response.razorpay_payment_id || null);
                                setOverlay('captured_failed');
                                return;
                            }

                            const alreadyProcessed = err?.message?.toLowerCase().includes('already processed');

                            if (alreadyProcessed) {
                                // Idempotent success — navigate to account
                                setOverlay('success');
                                toast.success('Your order has already been confirmed!');
                                setTimeout(() => navigate('/account', { replace: true }), 1200);
                            } else {
                                setOverlay('none');
                                setIsProcessing(false);
                                submittingRef.current = false;

                                toast.error(
                                    'Payment was captured but we had trouble confirming. Your order will appear in your account within minutes.',
                                    { duration: 8000 }
                                );
                                // Navigate to account so user can see if order landed
                                setTimeout(() => navigate('/account', { replace: true }), 3000);
                            }
                        }
                    },

                    prefill: {
                        name: shippingDetails.name || user?.displayName || 'Customer',
                        email: shippingDetails.email || user?.email || 'customer@example.com',
                        contact: shippingDetails.phone || '9999999999',
                        method:
                            !isIndiaCountry(shippingDetails.country) ? undefined
                            : paymentMethod === 'card' ? 'card'
                            : paymentMethod === 'upi' ? 'upi'
                            : paymentMethod === 'netbanking' ? 'netbanking'
                            : undefined
                    },

                    theme: { color: '#8B0000' },

                    modal: {
                        // Prevent Escape key from closing the modal
                        escape: false,
                        // Prevent clicking outside the modal from closing it
                        backdropclose: false,
                        confirm_close: true,
                        ondismiss: function () {
                            // User explicitly closed the Razorpay modal via the X button
                            // Draft order stays in DB as pending — webhook/cleanup handles it
                            setRazorpayModalOpen(false);
                            setOverlay('none');
                            setIsProcessing(false);
                            submittingRef.current = false;
                            toast('Payment cancelled. Your cart is still saved.', {
                                icon: '🛒',
                                duration: 4000,
                            });
                            // Don't navigate — let them stay on payment page to retry
                        }
                    }
                };

                const paymentObject = new (window as any).Razorpay(options);
                razorpayInstanceRef.current = paymentObject;

                // Set modal-open BEFORE clearing the init overlay so isLocked
                // stays true continuously — no gap where tab-close is unblocked.
                setRazorpayModalOpen(true);
                setOverlay('none');
                paymentObject.open();
            }
        } catch (err: any) {
            setOverlay('none');
            setIsProcessing(false);
            submittingRef.current = false;
            toast.error(err.message || 'Something went wrong. Please try again.');
        }
    };

    // ── Step indicator ────────────────────────────────────────────────────────
    const StepIndicator = ({
        step, title, active, complete
    }: { step: number; title: string; active: boolean; complete: boolean }) => (
        <div className={`flex items-center gap-2 ${active ? 'text-dark-red' : complete ? 'text-green-700' : 'text-gray-300'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                active ? 'border-dark-red text-dark-red'
                : complete ? 'bg-green-700 border-green-700 text-white'
                : 'border-gray-300 text-gray-300'
            }`}>
                {complete ? <Check size={12} strokeWidth={3} /> : step}
            </div>
            <span className={`font-sans text-xs tracking-widest uppercase hidden sm:block ${active ? 'font-bold' : ''}`}>
                {title}
            </span>
        </div>
    );

    // Determine banner urgency
    const showSessionBanner = secsRemaining !== null && !isLocked;
    const isSessionUrgent = secsRemaining !== null && secsRemaining <= URGENT_AT_SECS;

    return (
        <RequireAuth>
            <div className="min-h-screen bg-neutral-50 flex flex-col pt-24 relative">

                {/* ── Checkout Session Timer Banner ───────────────────────── */}
                {showSessionBanner && (
                    <div
                        className={`fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-sans font-medium transition-colors ${
                            isSessionUrgent
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-500 text-white'
                        }`}
                        role="alert"
                        aria-live="polite"
                    >
                        <Clock size={15} className={isSessionUrgent ? 'animate-pulse' : ''} />
                        <span>
                            {isSessionUrgent
                                ? `⚠️ Session expiring in ${formatCountdown(secsRemaining!)} — complete your payment now!`
                                : `Your checkout session expires in ${formatCountdown(secsRemaining!)}. Please complete your payment.`
                            }
                        </span>
                        <button
                            onClick={startOrResetSessionTimer}
                            className="ml-2 underline underline-offset-2 text-white/90 hover:text-white text-xs tracking-wide"
                            title="Extend session"
                        >
                            Extend
                        </button>
                    </div>
                )}

                {/* ── Full-screen Processing Overlay ─────────────────────── */}
                {(overlay === 'verifying' || overlay === 'success' || overlay === 'timeout' || overlay === 'init' || overlay === 'captured_failed' || overlay === 'cod_processing') && (
                    <div
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-6"
                        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}
                        aria-live="assertive"
                        role="status"
                    >
                        {overlay === 'init' && (
                            <>
                                <Loader2 size={48} className="text-dark-red animate-spin" />
                                <div className="text-center space-y-2">
                                    <p className="font-serif text-2xl text-dark-red">Preparing your payment…</p>
                                    <p className="font-sans text-sm text-gray-500">Setting up a secure checkout session</p>
                                </div>
                            </>
                        )}

                        {overlay === 'cod_processing' && (
                            <>
                                <Loader2 size={48} className="text-dark-red animate-spin" />
                                <div className="text-center space-y-2">
                                    <p className="font-serif text-2xl text-dark-red">Processing Order…</p>
                                    <p className="font-sans text-sm text-gray-500">Please wait while we confirm your order</p>
                                </div>
                            </>
                        )}

                        {overlay === 'verifying' && (
                            <>
                                <Loader2 size={48} className="text-dark-red animate-spin" />
                                <div className="text-center space-y-2 max-w-sm">
                                    <p className="font-serif text-2xl text-dark-red">Confirming your order…</p>
                                    <p className="font-sans text-sm text-gray-500">
                                        Payment captured! We're securely confirming your order.
                                        <br />
                                        <strong>Please do not close this tab or press back.</strong>
                                    </p>
                                </div>
                                <div className="flex gap-1 mt-2">
                                    {[0,1,2].map(i => (
                                        <div key={i} className="w-2 h-2 rounded-full bg-dark-red animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </div>
                            </>
                        )}

                        {overlay === 'success' && (
                            <>
                                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
                                    <Check size={40} className="text-green-600" strokeWidth={3} />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-serif text-2xl text-dark-red">Order Confirmed!</p>
                                    <p className="font-sans text-sm text-gray-500">Taking you to your invoice…</p>
                                </div>
                            </>
                        )}

                        {overlay === 'timeout' && (
                            <>
                                <AlertTriangle size={48} className="text-amber-500" />
                                <div className="text-center space-y-3 max-w-sm">
                                    <p className="font-serif text-2xl text-dark-red">Still Working…</p>
                                    <p className="font-sans text-sm text-gray-600">
                                        Your payment was captured but our server is taking longer than usual.
                                        Your order will appear in <strong>My Account → Orders</strong> within a few minutes.
                                    </p>
                                    <p className="font-sans text-xs text-gray-400">
                                        You will also receive a confirmation email shortly.
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/account', { replace: true })}
                                    className="mt-4 px-8 py-3 bg-dark-red text-white font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
                                >
                                    Go to My Account
                                </button>
                            </>
                        )}

                        {overlay === 'captured_failed' && (
                            <>
                                {/* Two-badge status row */}
                                <div className="flex items-center gap-3 flex-wrap justify-center">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 font-sans text-xs font-semibold tracking-wide">
                                        <Check size={13} strokeWidth={3} /> Payment Received
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-sans text-xs font-semibold tracking-wide">
                                        <AlertTriangle size={13} /> Order Delayed
                                    </span>
                                </div>

                                <div className="text-center space-y-2 max-w-sm">
                                    <p className="font-serif text-2xl text-dark-red">Payment Successful!</p>
                                    <p className="font-sans text-sm text-gray-600 leading-relaxed">
                                        Your payment was <strong>captured successfully</strong>, but we hit a
                                        temporary issue creating your order. Don't worry —{' '}
                                        <strong>your order will appear in My Orders within 5–10 minutes</strong>{' '}
                                        as our system retries automatically.
                                    </p>
                                </div>

                                {/* Reference number box */}
                                <div className="bg-amber-50 border border-amber-200 rounded-sm px-5 py-4 text-center w-full max-w-sm">
                                    <p className="font-sans text-[11px] uppercase tracking-widest text-amber-600 mb-1">Payment Reference</p>
                                    <p className="font-mono text-sm font-bold text-gray-800 break-all select-all">
                                        {capturedPaymentId || 'See confirmation email'}
                                    </p>
                                    <p className="font-sans text-[11px] text-gray-500 mt-2">
                                        Keep this for any support queries
                                    </p>
                                </div>

                                <div className="text-center space-y-1 max-w-sm">
                                    <p className="font-sans text-xs text-gray-500">
                                        Need help? Email us at{' '}
                                        <a href="mailto:bodiliciousnaturalproducts@gmail.com" className="text-dark-red underline underline-offset-2">
                                            bodiliciousnaturalproducts@gmail.com
                                        </a>
                                    </p>
                                    <p className="font-sans text-[11px] text-gray-400">
                                        Please include your payment reference above.
                                    </p>
                                </div>

                                <button
                                    onClick={() => navigate('/account', { replace: true })}
                                    className="mt-2 px-8 py-3 bg-dark-red text-white font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors rounded-sm"
                                >
                                    Go to My Orders
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 pb-12">
                    {/* Step Indicator */}
                    <div className="flex items-center justify-center mb-10 sm:mb-12">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <StepIndicator step={1} title="Bag" active={false} complete={true} />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <StepIndicator step={2} title="Shipping" active={false} complete={true} />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <StepIndicator step={3} title="Payment" active={true} complete={false} />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <StepIndicator step={4} title="Confirmation" active={false} complete={false} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        <div className="lg:col-span-7">
                            <h1 className="font-serif text-2xl text-dark-red mb-6">Payment Method</h1>

                            <form onSubmit={handlePlaceOrder} className="space-y-5">
                                {/* Payment method options — fully locked during processing */}
                                <fieldset disabled={isLocked} className="border-0 p-0 m-0">
                                    <div className={`border border-silk rounded-sm overflow-hidden bg-white shadow-sm transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="border-b border-silk">
                                            <label className="flex items-center px-4 py-4 cursor-pointer hover:bg-neutral-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="payment"
                                                    value="card"
                                                    checked={paymentMethod === 'card'}
                                                    onChange={() => setPaymentMethod('card')}
                                                    className="w-4 h-4 text-dark-red focus:ring-dark-red"
                                                />
                                                <div className="ml-4 flex items-center justify-between w-full">
                                                    <span className="font-sans text-sm tracking-wide text-gray-800">
                                                        {isIndiaCountry(shippingDetails.country) ? 'Credit / Debit Card' : 'Online Payment (Cards, Wallets, Bank Transfers)'}
                                                    </span>
                                                    {isIndiaCountry(shippingDetails.country) && (
                                                        <div className="flex gap-1 opacity-60">
                                                            <div className="w-8 h-5 bg-gray-200 rounded" />
                                                            <div className="w-8 h-5 bg-gray-200 rounded" />
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        </div>

                                        {isIndiaCountry(shippingDetails.country) && (
                                            <>
                                                <div className="border-b border-silk">
                                                    <label className="flex items-center px-4 py-4 cursor-pointer hover:bg-neutral-50 transition-colors">
                                                        <input
                                                            type="radio"
                                                            name="payment"
                                                            value="upi"
                                                            checked={paymentMethod === 'upi'}
                                                            onChange={() => setPaymentMethod('upi')}
                                                            className="w-4 h-4 text-dark-red focus:ring-dark-red"
                                                        />
                                                        <div className="ml-4 flex items-center w-full">
                                                            <span className="font-sans text-sm tracking-wide text-gray-800">UPI (GPay, PhonePe, Paytm)</span>
                                                        </div>
                                                    </label>
                                                </div>

                                                <div className="border-b border-silk">
                                                    <label className="flex items-center px-4 py-4 cursor-pointer hover:bg-neutral-50 transition-colors">
                                                        <input
                                                            type="radio"
                                                            name="payment"
                                                            value="netbanking"
                                                            checked={paymentMethod === 'netbanking'}
                                                            onChange={() => setPaymentMethod('netbanking')}
                                                            className="w-4 h-4 text-dark-red focus:ring-dark-red"
                                                        />
                                                        <div className="ml-4 flex items-center w-full">
                                                            <span className="font-sans text-sm tracking-wide text-gray-800">Net Banking</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </>
                                        )}

                                        <div>
                                            <label className={`flex items-center px-4 py-4 ${!codAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-50'} transition-colors`}>
                                                <input
                                                    type="radio"
                                                    name="payment"
                                                    value="cod"
                                                    checked={paymentMethod === 'cod'}
                                                    onChange={() => {
                                                        if (codAvailable) setPaymentMethod('cod');
                                                    }}
                                                    disabled={!codAvailable || isLocked}
                                                    className="w-4 h-4 text-dark-red focus:ring-dark-red disabled:bg-gray-200"
                                                />
                                                <div className="ml-4 flex flex-col w-full">
                                                    <span className="font-sans text-sm tracking-wide text-gray-800">Cash on Delivery</span>
                                                    {codUnavailableReason && (
                                                        <span className="font-sans text-[10px] text-gray-500 mt-0.5">{codUnavailableReason}</span>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="pt-6">
                                    <label className={`flex items-center gap-2 cursor-pointer ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={billingSameAsShipping}
                                            onChange={() => setBillingSameAsShipping(!billingSameAsShipping)}
                                            className="w-4 h-4 text-dark-red rounded-sm border-silk focus:ring-dark-red"
                                            disabled={isLocked}
                                        />
                                        <span className="font-sans text-sm text-gray-700">Billing address same as shipping</span>
                                    </label>
                                </div>
                                
                                {!billingSameAsShipping && (
                                    <div className="mt-4 p-5 border border-silk bg-neutral-50/50 rounded-sm space-y-4">
                                        <h3 className="font-serif text-lg text-dark-red">Billing Address</h3>
                                        <div>
                                            <select
                                                value={billingDetails.country}
                                                onChange={e => setBillingDetails(p => ({ ...p, country: e.target.value }))}
                                                onBlur={() => touchBilling('country')}
                                                className={fieldCls('country')}
                                                disabled={isLocked}
                                            >
                                                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Full Name"
                                                value={billingDetails.name}
                                                onChange={e => setBillingDetails(p => ({ ...p, name: e.target.value }))}
                                                onBlur={() => touchBilling('name')}
                                                className={fieldCls('name')}
                                                disabled={isLocked}
                                            />
                                            {billingErrors.name && <p className="text-xs text-red-500 mt-1">{billingErrors.name}</p>}
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Address / Street"
                                                value={billingDetails.address}
                                                onChange={e => setBillingDetails(p => ({ ...p, address: e.target.value }))}
                                                onBlur={() => touchBilling('address')}
                                                className={fieldCls('address')}
                                                disabled={isLocked}
                                            />
                                            {billingErrors.address && <p className="text-xs text-red-500 mt-1">{billingErrors.address}</p>}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-1">
                                                <input
                                                    type="text"
                                                    placeholder="City"
                                                    value={billingDetails.city}
                                                    onChange={e => setBillingDetails(p => ({ ...p, city: e.target.value }))}
                                                    onBlur={() => touchBilling('city')}
                                                    className={fieldCls('city')}
                                                    disabled={isLocked}
                                                />
                                                {billingErrors.city && <p className="text-xs text-red-500 mt-1">{billingErrors.city}</p>}
                                            </div>
                                            <div className="md:col-span-1">
                                                <input
                                                    type="text"
                                                    placeholder="State / Province"
                                                    value={billingDetails.state}
                                                    onChange={e => setBillingDetails(p => ({ ...p, state: e.target.value }))}
                                                    onBlur={() => touchBilling('state')}
                                                    className={fieldCls('state')}
                                                    disabled={isLocked}
                                                />
                                                {billingErrors.state && <p className="text-xs text-red-500 mt-1">{billingErrors.state}</p>}
                                            </div>
                                            <div className="md:col-span-1">
                                                <input
                                                    type="text"
                                                    placeholder={isIndiaCountry(billingDetails.country) ? '6-digit PIN Code' : 'Zip / Postal Code'}
                                                    value={billingDetails.pincode}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (isIndiaCountry(billingDetails.country)) {
                                                            if (val === '' || /^\d+$/.test(val)) setBillingDetails(p => ({ ...p, pincode: val }));
                                                        } else {
                                                            setBillingDetails(p => ({ ...p, pincode: val }));
                                                        }
                                                    }}
                                                    onBlur={() => touchBilling('pincode')}
                                                    className={fieldCls('pincode')}
                                                    maxLength={isIndiaCountry(billingDetails.country) ? 6 : 12}
                                                    disabled={isLocked}
                                                />
                                                {billingErrors.pincode && <p className="text-xs text-red-500 mt-1">{billingErrors.pincode}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4">
                                    {rateLimitSecs !== null && (
                                        <div className="bg-orange-50 border border-orange-200 p-4 flex flex-col items-center justify-center gap-2 rounded-sm mb-4">
                                            <div className="flex items-center gap-2 text-orange-800 font-sans font-medium text-sm">
                                                <Clock size={16} className="animate-pulse" />
                                                Too many requests
                                            </div>
                                            <p className="text-xs text-orange-700 text-center">
                                                Retrying shipping quote in <strong>{rateLimitSecs}s</strong>...
                                            </p>
                                        </div>
                                    )}
                                    {quoteError && !rateLimitSecs && (
                                        <p className="text-xs text-red-500 mb-4 text-center">{quoteError}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isLocked || rateLimitSecs !== null || !!quoteError}
                                        aria-busy={isLocked}
                                        className={`w-full py-4 text-white font-sans text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
                                            isLocked || rateLimitSecs !== null || !!quoteError
                                                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                                : 'bg-dark-red hover:bg-ruby-red shadow-md hover:shadow-lg active:scale-[0.99]'
                                        }`}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Processing…
                                            </>
                                        ) : (
                                            <>Place Order ({formatCurrency(total, quoteData?.currency || 'INR')}) <ChevronRight size={16} /></>
                                        )}
                                    </button>
                                </div>
                                
                                {/* Customs Disclosure for International */}
                                {shippingDetails?.country && !['india', 'in', 'bharat', 'ind'].includes(shippingDetails.country.toLowerCase().trim()) && (
                                    <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-sm flex items-start gap-3">
                                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-800">
                                            <strong>International Shipping Notice:</strong> Your country's customs office may impose import duties, taxes, or clearance fees. 
                                            These charges are the buyer's responsibility and are not included in the checkout total.
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* ── Order Summary ───────────────────────────────────── */}
                        <div className="lg:col-span-5 relative">
                            <div className="sticky top-28 bg-white border border-silk p-5 shadow-sm rounded-sm">
                                <h2 className="font-serif text-xl text-dark-red mb-5">Order Summary</h2>

                                <div className="space-y-4 mb-5 max-h-[300px] overflow-y-auto pr-2">
                                    {validCartItems.map((item: CartItem, idx: number) => (
                                        <div key={idx} className="flex gap-4">
                                            <div className="w-16 h-20 bg-silk-light shrink-0">
                                                <img
                                                    loading="lazy"
                                                    src={item.product.images[0]}
                                                    alt=""
                                                    className="w-full h-full object-contain p-1 mix-blend-multiply"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <h3 className="font-serif text-sm text-dark-red truncate">{item.product.name}</h3>
                                                <p className="font-sans text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
                                            </div>
                                            <div className="shrink-0 flex items-center font-sans text-sm font-semibold text-gray-900">
                                                {formatPrice(item.product.price * item.quantity)}
                                                {userCurrency === 'USD' && <span className="text-[10px] ml-0.5 opacity-60">*</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-silk pt-4 space-y-3 font-sans text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>{quoteData?.subtotal !== undefined ? formatCurrency(quoteData.subtotal, quoteData.currency) : formatPrice(cartTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className={shippingCost === 0 ? 'text-green-700 font-medium' : 'text-gray-900'}>
                                            {shippingCost === 0 ? 'Free' : formatCurrency(shippingCost, quoteData?.currency || 'INR')}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-silk mt-4 pt-4 flex justify-between font-serif text-xl text-dark-red">
                                    <span>Total</span>
                                    <span>{formatCurrency(total, quoteData?.currency || 'INR')}</span>
                                </div>

                                {/* GST is contained within Total, not added to it — so this is a
                                    disclosure line, never a second charge. Hidden entirely when the
                                    store rate is 0 or the order is an export (zero-rated).
                                    quoteData amounts are ALREADY in the checkout currency, so this
                                    must use formatCurrency, never formatPrice. */}
                                {(quoteData?.taxAmount ?? 0) > 0 && (
                                    <div className="mt-1 text-right font-sans text-[11px] text-gray-500">
                                        Includes GST{quoteData?.taxRatePercent ? ` (${quoteData.taxRatePercent}%)` : ''}{' '}
                                        {formatCurrency(quoteData!.taxAmount!, quoteData?.currency || 'INR')}
                                    </div>
                                )}

                                {quoteData?.isFallback && (
                                    <div className="mt-3 text-xs font-sans text-gray-500 bg-gray-50 p-3 rounded-sm border border-gray-100 leading-relaxed text-center">
                                        Your selected currency ({userCurrency}) is not supported for checkout.<br />
                                        You will be billed exactly <strong>{formatCurrency(total, 'INR')}</strong>.<br />
                                        Your bank may apply a conversion fee.
                                    </div>
                                )}

                                <div className="mt-6 flex items-center justify-center gap-2 text-green-700 bg-green-50/50 p-2.5 rounded-sm border border-green-100">
                                    <ShieldCheck size={16} />
                                    <span className="font-sans text-[11px] font-medium tracking-wide">
                                        100% Secure Payment. 256-bit SSL Encryption.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </RequireAuth>
    );
}