import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { CheckCircle2, XCircle, PackageX, ChevronRight, FileText, Check, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';

const CONFIRMATION_STATE_KEY = 'bodilicious_confirmation_state';

type ConfirmationState = { orderId: string; status: 'success' | 'failed' | 'cancelled' };

export default function ConfirmationPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { orders, refreshProfile } = useApp();

    // ── Recover state from router OR sessionStorage (survives page refresh) ──
    const routerState = location.state as ConfirmationState | undefined;

    const [resolvedState] = useState<ConfirmationState | null>(() => {
        if (routerState?.orderId) {
            // Persist to sessionStorage so we can survive a refresh
            sessionStorage.setItem(CONFIRMATION_STATE_KEY, JSON.stringify(routerState));
            return routerState;
        }
        // Try recovering from sessionStorage (user refreshed)
        try {
            const saved = sessionStorage.getItem(CONFIRMATION_STATE_KEY);
            if (saved) return JSON.parse(saved) as ConfirmationState;
        } catch { /* ignore */ }
        return null;
    });

    // ── Order found in context? ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = resolvedState ? orders.find(o => (o as any)._id === resolvedState.orderId) : undefined;
    const orderLoaded = !!order;

    // ── beforeunload guard while the order hasn't appeared yet ──────────────
    useEffect(() => {
        if (orderLoaded) return; // once loaded, remove the guard

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Your invoice is still loading. Are you sure you want to leave?';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [orderLoaded]);

    // ── Auto-poll: re-fetch profile until the order appears ─────────────────
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [pollCount, setPollCount] = useState(0);
    const MAX_POLLS = 10; // try up to 10 times (every 2s = 20s max)

    useEffect(() => {
        if (orderLoaded || !resolvedState) return; // already have it, or no state

        const run = async () => {
            await refreshProfile();
            setPollCount(c => c + 1);
        };

        // kick off immediately
        run();

        pollRef.current = setInterval(run, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // run only once on mount / when resolvedState changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedState?.orderId]);

    // Stop polling once loaded or after max attempts
    useEffect(() => {
        if (orderLoaded || pollCount >= MAX_POLLS) {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [orderLoaded, pollCount]);

    // ── Redirect if no state at all ──────────────────────────────────────────
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!resolvedState) {
            navigate('/account');
        }
    }, [resolvedState, navigate]);

    if (!resolvedState) return null;

    // ── Loading state while we wait for the order ───────────────────────────
    if (!orderLoaded) {
        const timedOut = pollCount >= MAX_POLLS;
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col pt-24 items-center justify-center gap-6 px-4">
                {timedOut ? (
                    <div className="text-center space-y-4 max-w-sm">
                        <AlertTriangle size={40} className="text-amber-500 mx-auto" />
                        <h2 className="font-serif text-2xl text-dark-red">Still Loading…</h2>
                        <p className="font-sans text-sm text-gray-600">
                            Your order was placed successfully but we're having trouble fetching the details.
                            Please visit <strong>My Account → Orders</strong> to view your invoice.
                        </p>
                        <button
                            onClick={() => { sessionStorage.removeItem(CONFIRMATION_STATE_KEY); navigate('/account'); }}
                            className="px-6 py-3 bg-dark-red text-white font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors"
                        >
                            Go to My Account
                        </button>
                    </div>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-dark-red mx-auto" />
                        <p className="font-sans text-sm text-gray-600 tracking-wide">
                            Fetching your invoice — please don't refresh this page…
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // ── Clear sessionStorage once invoice is displayed ───────────────────────
    sessionStorage.removeItem(CONFIRMATION_STATE_KEY);

    const StepIndicator = ({ step, title, active, complete }: { step: number, title: string, active: boolean, complete: boolean }) => (
        <div className={`flex items-center gap-2 ${active ? 'text-dark-red' : complete ? 'text-green-700' : 'text-gray-300'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${active ? 'border-dark-red text-dark-red' :
                complete ? 'bg-green-700 border-green-700 text-white' :
                    'border-gray-300 text-gray-300'
                }`}>
                {complete ? <Check size={12} strokeWidth={3} /> : step}
            </div>
            <span className={`font-sans text-xs tracking-widest uppercase hidden sm:block ${active ? 'font-bold' : ''}`}>
                {title}
            </span>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col pt-28">
            <div className="flex-1 max-w-4xl mx-auto w-full px-6 pb-16">

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-12 sm:mb-16">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <StepIndicator step={1} title="Bag" active={false} complete={true} />
                        <div className="w-8 sm:w-16 h-[1px] bg-gray-300"></div>
                        <StepIndicator step={2} title="Shipping" active={false} complete={true} />
                        <div className="w-8 sm:w-16 h-[1px] bg-gray-300"></div>
                        <StepIndicator step={3} title="Payment" active={false} complete={true} />
                        <div className="w-8 sm:w-16 h-[1px] bg-gray-300"></div>
                        <StepIndicator step={4} title="Confirmation" active={true} complete={false} />
                    </div>
                </div>

                {/* Status Hero */}
                <div className="bg-white p-8 sm:p-12 mb-8 border border-silk shadow-sm text-center">
                    {resolvedState.status === 'success' || order.paymentStatus === 'paid' || order.paymentMethod === 'cod' ? (
                        <>
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 size={40} className="text-green-600" />
                            </div>
                            <h1 className="font-serif text-3xl sm:text-4xl text-dark-red mb-3">Order Confirmed!</h1>
                            <p className="font-sans text-gray-600 max-w-md mx-auto">
                                Thank you for your purchase. We have received your order and will begin processing it shortly.
                            </p>
                        </>
                    ) : resolvedState.status === 'failed' || order.paymentStatus === 'failed' ? (
                        <>
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle size={40} className="text-red-600" />
                            </div>
                            <h1 className="font-serif text-3xl sm:text-4xl text-dark-red mb-3">Payment Failed</h1>
                            <p className="font-sans text-gray-600 max-w-md mx-auto">
                                Unfortunately, we could not process your payment. Your order has been marked as failed.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <PackageX size={40} className="text-gray-600" />
                            </div>
                            <h1 className="font-serif text-3xl sm:text-4xl text-dark-red mb-3">Order Cancelled</h1>
                            <p className="font-sans text-gray-600 max-w-md mx-auto">
                                You cancelled the payment process. This pending order has been cancelled in our system.
                            </p>
                        </>
                    )}
                </div>

                {/* Details Section */}
                <div className="bg-white p-6 sm:p-10 border border-silk shadow-sm">
                    <div className="flex items-center gap-3 mb-8 border-b border-silk pb-6">
                        <FileText size={24} className="text-dark-red" />
                        <h2 className="font-serif text-2xl text-dark-red">Invoice Summary</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                        {/* Left Info */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-sans text-xs tracking-widest uppercase text-gray-400 mb-2">Order Information</h3>
                                <p className="font-sans text-sm text-gray-800"><span className="font-semibold">Order ID:</span> {order._id}</p>
                                <p className="font-sans text-sm text-gray-800"><span className="font-semibold">Date:</span> {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p className="font-sans text-sm text-gray-800"><span className="font-semibold">Payment Method:</span> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
                                {order.razorpayPaymentId && (
                                    <p className="font-sans text-sm text-gray-800"><span className="font-semibold">Transaction ID:</span> {order.razorpayPaymentId}</p>
                                )}
                            </div>

                            <div>
                                <h3 className="font-sans text-xs tracking-widest uppercase text-gray-400 mb-2">Shipping Details</h3>
                                <p className="font-sans text-sm text-gray-800 font-semibold">{order.shippingDetails.name}</p>
                                <p className="font-sans text-sm text-gray-800 max-w-[250px] leading-relaxed mt-1">
                                    {order.shippingDetails.address}<br />
                                    {order.shippingDetails.city}, {order.shippingDetails.state} {order.shippingDetails.pincode}
                                </p>
                                <p className="font-sans text-sm text-gray-800 mt-2">Phone: +91 {order.shippingDetails.phone}</p>
                            </div>
                        </div>

                        {/* Right Summary */}
                        <div className="bg-neutral-50 p-6 border border-silk/50 rounded-sm">
                            <h3 className="font-sans text-xs tracking-widest uppercase text-gray-400 mb-4">Items Ordered</h3>

                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 mb-6">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-3 border border-silk/30 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-silk-light shrink-0">
                                                <img 
                                                  loading="lazy"
                                                  src={item.product?.images?.[0] || 'https://via.placeholder.com/40'} 
                                                  alt="" 
                                                  className="w-full h-full object-contain p-1 mix-blend-multiply" 
                                                />
                                            </div>
                                            <div>
                                                <p className="font-serif text-sm text-dark-red line-clamp-1">{item.product?.name || 'Product'}</p>
                                                <p className="font-sans text-xs text-gray-500">Qty: {item.quantity}</p>
                                            </div>
                                        </div>
                                        <p className="font-sans text-sm font-semibold">₹{(item.priceAtPurchase * item.quantity).toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-silk pt-4 space-y-2">
                                <div className="flex justify-between font-sans text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span>₹{(order.totalAmount - (order.totalAmount < 999 ? 99 : 0)).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between font-sans text-sm text-gray-600">
                                    <span>Shipping</span>
                                    <span>{order.totalAmount < 999 ? '₹99' : 'Free'}</span>
                                </div>
                                <div className="flex justify-between font-serif text-xl text-dark-red mt-4 pt-4 border-t border-silk">
                                    <span>Total Amount</span>
                                    <span>₹{order.totalAmount.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                        <button
                            onClick={() => navigate('/account')}
                            className="px-8 py-3 border border-silk text-dark-red font-sans text-xs tracking-widest uppercase hover:bg-neutral-50 transition-colors"
                        >
                            Back to Account
                        </button>
                        <button
                            onClick={() => navigate('/shop')}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors shadow-md hover:shadow-lg"
                        >
                            Continue Shopping <ChevronRight size={16} />
                        </button>
                    </div>

                </div>
            </div>
            <Footer />
        </div>
    );
}
