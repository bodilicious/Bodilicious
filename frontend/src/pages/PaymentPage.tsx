
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Check, ShieldCheck, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';
import RequireAuth from '../components/RequireAuth';
import toast from 'react-hot-toast';
import { CartItem } from '../types';

// ─── Razorpay script loader (idempotent) ─────────────────────────────────────
const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) { resolve(true); return; }
        const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(!!(window as any).Razorpay));
            existing.addEventListener('error', () => resolve(false));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(!!(window as any).Razorpay);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// ─── Verify timeout (ms) — after this we tell user to check account ──────────
const VERIFY_TIMEOUT_MS = 25_000;

// ─── Processing overlay states ────────────────────────────────────────────────
type OverlayState = 'none' | 'init' | 'verifying' | 'success' | 'timeout' | 'captured_failed' | 'cod_processing';

export default function PaymentPage() {
    const { cartItems, cartTotal, checkout, initRazorpayOrder, verifyPayment, user, products, storeSettings } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    const [paymentMethod, setPaymentMethod] = useState('card');
    // isProcessing = button spinner (init phase only)
    const [isProcessing, setIsProcessing] = useState(false);
    // overlay = full-screen lock once Razorpay handler fires
    const [overlay, setOverlay] = useState<OverlayState>('none');
    const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

    const razorpayInstanceRef = useRef<any>(null);
    // COD double-submit guard
    const submittingRef = useRef(false);
    // Verify timeout timer
    const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Razorpay payment ID stored when overlay='captured_failed' so the UI can display it
    const [capturedPaymentId, setCapturedPaymentId] = useState<string | null>(null);
    // True while the Razorpay modal is open — keeps isLocked=true so tab-close is blocked
    const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);

    const shippingDetails = location.state?.shippingDetails;
    const isLocked = isProcessing || overlay !== 'none' || razorpayModalOpen;

    // ── Redirect if no shipping details ──────────────────────────────────────
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!shippingDetails) navigate('/cart', { replace: true });
    }, [shippingDetails, navigate]);

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
        const handlePopState = (e: PopStateEvent) => {
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

    if (!shippingDetails) return null;

    const validCartItems = cartItems.filter((item: CartItem) => item && item.product);
    const shippingCost = cartTotal >= storeSettings.shippingThreshold ? 0 : storeSettings.shippingCost;
    const total = cartTotal + shippingCost;

    // ── Build items payload ───────────────────────────────────────────────────
    const buildItemsPayload = () => {
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
    };

    // ── Main submit handler ───────────────────────────────────────────────────
    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        // Hard guard: never allow double-submit
        if (submittingRef.current || isLocked) return;
        submittingRef.current = true;
        setIsProcessing(true);

        try {
            if (paymentMethod === 'cod') {
                setOverlay('cod_processing');
                const { order } = await checkout(shippingDetails);
                // Don't reset isProcessing — navigate immediately
                navigate('/confirmation', { state: { orderId: (order as any)._id, status: 'success' }, replace: true });

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
                const { razorpayOrder } = await initRazorpayOrder(items, shippingDetails);
                setIsProcessing(false); // spinner → overlay takes over

                const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
                if (!razorpayKey) throw new Error('Payment configuration error. Please contact support.');

                // ── 3. Open Razorpay modal ────────────────────────────────────
                const options: any = {
                    key: razorpayKey,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    name: 'Bodilicious',
                    description: 'Premium Herbal Beauty',
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
                                    state: { orderId: (order as any)._id, status: 'success' },
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
                            paymentMethod === 'card' ? 'card'
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

    return (
        <RequireAuth>
            <div className="min-h-screen bg-neutral-50 flex flex-col pt-24 relative">

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
                                                    <span className="font-sans text-sm tracking-wide text-gray-800">Credit / Debit Card</span>
                                                    <div className="flex gap-1 opacity-60">
                                                        <div className="w-8 h-5 bg-gray-200 rounded" />
                                                        <div className="w-8 h-5 bg-gray-200 rounded" />
                                                    </div>
                                                </div>
                                            </label>
                                        </div>

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

                                        <div>
                                            <label className="flex items-center px-4 py-4 cursor-pointer hover:bg-neutral-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="payment"
                                                    value="cod"
                                                    checked={paymentMethod === 'cod'}
                                                    onChange={() => setPaymentMethod('cod')}
                                                    className="w-4 h-4 text-dark-red focus:ring-dark-red"
                                                />
                                                <div className="ml-4 flex items-center w-full">
                                                    <span className="font-sans text-sm tracking-wide text-gray-800">Cash on Delivery</span>
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

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={isLocked}
                                        aria-busy={isLocked}
                                        className={`w-full py-4 text-white font-sans text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
                                            isLocked
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
                                            <>Place Order (₹{total.toLocaleString('en-IN')}) <ChevronRight size={16} /></>
                                        )}
                                    </button>
                                </div>
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
                                                ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-silk pt-4 space-y-3 font-sans text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className={shippingCost === 0 ? 'text-green-700 font-medium' : 'text-gray-900'}>
                                            {shippingCost === 0 ? 'Free' : `₹${shippingCost}`}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-silk mt-4 pt-4 flex justify-between font-serif text-xl text-dark-red">
                                    <span>Total</span>
                                    <span>₹{total.toLocaleString('en-IN')}</span>
                                </div>

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