 
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import {
    ArrowLeft,
    Package,
    CheckCircle2,
    Clock,
    RefreshCw,
    AlertCircle,
    Printer,
    MessageSquare,
    Send
} from 'lucide-react';
import { TimelineEvent } from '../types';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

export default function OrderDetailsPage() {
    const { orderId: urlOrderId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { orders, selectedOrderId, authLoading, isAuthenticated, navigateTo, getAuthHeaders, updateOrderAddress, cancelOrder, requestReturn } = useApp();
    const [order, setOrder] = useState<Order | null>(null);

    // Tracking state
    const [trackingData, setTrackingData] = useState<{
        status: string;
        expectedDelivery: string;
        timeline: TimelineEvent[];
    } | null>(null);
    const [isTrackingLoading, setIsTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState('');

    // Editing Address state
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [editForm, setEditForm] = useState<{
        name: string;
        phone: string;
        email: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
    }>({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    });

    // Cancel / Return Modal state
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    // Comments state
    const [comments, setComments] = useState<{ text: string; createdAt: string }[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    const fetchTracking = useCallback(async (currentOrder: Order) => {
        setIsTrackingLoading(true);
        setTrackingError('');
        setTrackingData(null);

        try {
            if (!currentOrder.awb) {
                if (currentOrder.orderStatus === 'cancelled') {
                    setTrackingData({
                        status: 'Cancelled',
                        expectedDelivery: 'N/A',
                        timeline: [
                            { status: 'Order Confirmed', location: 'System', date: new Date(currentOrder.createdAt).toLocaleDateString(), completed: true },
                            { status: 'Cancelled', location: 'System', date: '', completed: true }
                        ]
                    });
                    return;
                }

                setTrackingData({
                    status: currentOrder.orderStatus.charAt(0).toUpperCase() + currentOrder.orderStatus.slice(1),
                    expectedDelivery: 'Soon',
                    timeline: [
                        { status: 'Order Confirmed', location: 'System', date: new Date(currentOrder.createdAt).toLocaleDateString(), completed: true },
                        { status: 'Processing', location: 'Warehouse', date: '', completed: false },
                        { status: 'Shipped', location: '', date: '', completed: false },
                        { status: 'Out for Delivery', location: '', date: '', completed: false },
                        { status: 'Delivered', location: '', date: '', completed: false }
                    ]
                });
                return;
            }

            const headers = await getAuthHeaders();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/orders/shiprocket/${currentOrder.awb}`, { headers });
            const data = await res.json();

            if (!res.ok) {
                if (currentOrder.orderStatus === 'cancelled') {
                    setTrackingData({
                        status: 'Cancelled', expectedDelivery: 'N/A',
                        timeline: [
                            { status: 'Order Confirmed', location: 'System', date: new Date(currentOrder.createdAt).toLocaleDateString(), completed: true },
                            { status: 'Cancelled', location: 'System', date: '', completed: true }
                        ]
                    });
                    return;
                }
                throw new Error(data.message || 'Failed to fetch tracking details');
            }

            setTrackingData(data.data);
        } catch (err: any) {
            setTrackingError(err.message || 'An error occurred while tracking your order');
            setTrackingData({
                status: currentOrder.orderStatus, expectedDelivery: 'Pending',
                timeline: [
                    { status: 'Order Confirmed', location: 'System', date: new Date(currentOrder.createdAt).toLocaleDateString(), completed: true },
                    { status: 'Pending Tracking Update', location: '', date: '', completed: false }
                ]
            });
        } finally {
            setIsTrackingLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (authLoading) return;

        // If not authenticated, redirect to signin with current path in state
        if (!isAuthenticated) {
            navigate('/signin', { state: { returnTo: location.pathname } });
            return;
        }

        const targetOrderId = urlOrderId || selectedOrderId;

        if (!targetOrderId) {
            navigateTo('tracking');
            return;
        }

        const foundOrder = orders.find(o => o._id === targetOrderId);
        if (foundOrder) {
            setOrder(foundOrder);
            setComments((foundOrder as any).customerComments || []);
            setEditForm({
                name: foundOrder.shippingDetails?.name || '',
                phone: foundOrder.shippingDetails?.phone || '',
                email: foundOrder.shippingDetails?.email || '',
                address: foundOrder.shippingDetails?.address || '',
                city: foundOrder.shippingDetails?.city || '',
                state: foundOrder.shippingDetails?.state || '',
                pincode: foundOrder.shippingDetails?.pincode || ''
            });

            fetchTracking(foundOrder);
        } else if (orders.length > 0) {
            // If orders are loaded but not found, redirect to tracking list
            navigateTo('tracking');
        }
    }, [authLoading, isAuthenticated, urlOrderId, selectedOrderId, orders, navigateTo, location.pathname, navigate, fetchTracking]);

    const handleSaveAddress = async () => {
        if (!order) return;
        setIsSavingAddress(true);
        try {
            const updatedOrder = await updateOrderAddress(order._id, editForm);
            setOrder(updatedOrder);
            setIsEditingAddress(false);
            toast.success("Address updated successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to save address");
        } finally {
            setIsSavingAddress(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order) return;
        setIsProcessingAction(true);
        try {
            await cancelOrder(order._id);
            toast.success("Order cancelled successfully.");
            setIsCancelModalOpen(false);
            // Refresh order
            const foundOrder = orders.find(o => o._id === order._id);
            if (foundOrder) setOrder(foundOrder);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel order");
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleRequestReturn = async () => {
        if (!order) return;
        if (returnReason.trim().length < 5) {
            toast.error("Please provide a longer reason (min 5 chars).");
            return;
        }
        setIsProcessingAction(true);
        try {
            await requestReturn(order._id, returnReason);
            toast.success("Return request submitted successfully.");
            setIsReturnModalOpen(false);
            setReturnReason('');
            const foundOrder = orders.find(o => o._id === order._id);
            if (foundOrder) setOrder(foundOrder);
        } catch (err: any) {
            toast.error(err.message || "Failed to submit return request");
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleAddComment = async () => {
        if (!order || newComment.trim().length === 0) return;
        setCommentLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/v1/orders/${order._id}/comment`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text: newComment.trim() }),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to post comment');
            setComments(data.data);
            setNewComment('');
            toast.success('Comment added');
        } catch (e: any) {
            toast.error(e.message || 'Could not post comment');
        } finally {
            setCommentLoading(false);
        }
    };

    const handlePrintInvoice = () => {
        window.print();
    };

    if (!order) return null;

    // Badge styling helpers
    const getPaymentBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'bg-green-100 text-green-800 border-green-200';
        if (s === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if (s === 'refunded') return 'bg-purple-100 text-purple-800 border-purple-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getFulfillmentBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'delivered' || s === 'shipped') return 'bg-green-100 text-green-800 border-green-200';
        if (s === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
        if (s === 'return_requested') return 'bg-orange-100 text-orange-800 border-orange-200';
        if (s === 'returned') return 'bg-purple-100 text-purple-800 border-purple-200';
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    const rawShippingCost = order.shippingCost ?? 0;
    const rawDiscountAmount = order.discountAmount ?? 0;
    const rawTaxAmount = order.taxAmount ?? 0;
    const rawTotalAmount = order.totalAmount ?? 0;
    const rawSubtotal = (order.originalAmount ?? rawTotalAmount) - rawShippingCost;
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: order.currency || 'INR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const HorizontalTimeline = ({ timeline, status }: { timeline: TimelineEvent[], status: string }) => {
        const isErrorState = status.toLowerCase() === 'cancelled' || status.toLowerCase().includes('fail');
        const activeColor = isErrorState ? 'bg-red-500' : 'bg-dark-red';

        return (
            <div className="w-full mt-4 mb-8 hidden sm:block print:hidden">
                <div className="relative flex justify-between items-center mb-8 px-8">
                    <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-gray-200 -z-10"></div>
                    {timeline.length > 0 && (
                        <div
                            className={`absolute left-8 top-1/2 -translate-y-1/2 h-1 ${activeColor} -z-10 transition-all duration-500`}
                            style={{ width: `calc(${(timeline.filter(t => t.completed).length - 1) / (timeline.length - 1) * 100}% - 4rem)` }}
                        ></div>
                    )}
                    {timeline.map((event, idx) => (
                        <div key={idx} className="relative flex flex-col items-center z-10">
                            <div className={`w-5 h-5 rounded-full border-[3px] ${event.completed ? (isErrorState ? 'bg-red-500 border-red-500' : 'bg-dark-red border-dark-red') : 'bg-neutral-50 border-gray-300'} transition-colors duration-500 shadow-sm`}></div>
                            <div className="absolute top-8 w-24 text-center">
                                <p className={`text-xs font-semibold ${event.completed ? 'text-gray-900' : 'text-gray-400'}`}>{event.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <div className="flex flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16">
                <main className="flex-1">
                    <button
                        onClick={() => navigateTo('tracking')}
                        className="flex items-center gap-2 text-sm text-grey-beige hover:text-dark-red transition-colors mb-6 font-sans print:hidden w-fit"
                    >
                        <ArrowLeft size={16} /> Back to Orders
                    </button>
                    <div>

                        {/* Print Invoice Header (Visible only when printing) */}
                        <div className="hidden print:block border-b border-gray-200 pb-6 mb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl font-serif text-[#700000]">Bodilicious</h1>
                                    <p className="text-sm text-gray-500 mt-1">Official Tax Invoice</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-gray-900">Invoice / Order #{order._id.substring(order._id.length - 8).toUpperCase()}</p>
                                    <p className="text-sm text-gray-500">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                                    {order.razorpayOrderId && <p className="text-xs text-gray-400 mt-1">Ref: {order.razorpayOrderId}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Top Header Section */}
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4 print:hidden">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-serif text-dark-red">Order #{order._id.substring(order._id.length - 8).toUpperCase()}</h1>
                                    <span className={`px-3 py-1 text-xs font-sans tracking-widest uppercase border border-opacity-50 ${getPaymentBadge(order.paymentStatus)}`}>
                                        {order.paymentStatus.replace('_', ' ')}
                                    </span>
                                    <span className={`px-3 py-1 text-xs font-sans tracking-widest uppercase border border-opacity-50 ${getFulfillmentBadge(order.orderStatus)}`}>
                                        {order.orderStatus.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm font-sans text-grey-beige">
                                    Placed on {new Date(order.createdAt).toLocaleString()} from Bodilicious
                                </p>
                                {order.estimatedDeliveryDate && ['pending', 'processing', 'shipped'].includes(order.orderStatus.toLowerCase()) && (
                                    <div className="mt-2 text-sm text-gray-700 bg-neutral-50 px-3 py-2 border border-gray-100 rounded inline-block">
                                        <p className="font-medium whitespace-nowrap">
                                            🚚 Expected Delivery by {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                                                day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
                                            })}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            Based on current courier serviceability
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end mt-4 sm:mt-0">
                                {(order.orderStatus === 'pending' || order.orderStatus === 'processing') && (
                                    <button onClick={() => setIsCancelModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors shadow-sm w-full sm:w-auto justify-center">
                                        Cancel Order
                                    </button>
                                )}
                                {(() => {
                                    if (order.orderStatus !== 'delivered' || order.returnStatus !== 'none') return false;
                                    const deliveryDateStr = order.updatedAt || order.estimatedDeliveryDate;
                                    const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr) : new Date(order.createdAt);
                                    const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
                                    return daysSinceDelivery <= 7;
                                })() && (
                                    <button onClick={() => setIsReturnModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 transition-colors shadow-sm w-full sm:w-auto justify-center">
                                        Return Order
                                    </button>
                                )}
                                <button onClick={handlePrintInvoice} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-dark-red bg-white border border-dark-red hover:bg-neutral-50 transition-colors shadow-sm w-full sm:w-auto justify-center">
                                    <Printer size={16} /> Print Invoice
                                </button>
                            </div>
                        </div>

                        {/* Shiprocket Tracker Map */}
                        <div className="bg-white rounded-none shadow-sm border border-gray-200 overflow-hidden print:hidden mb-8">
                            <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center">
                                <h3 className="text-base font-serif text-dark-red flex items-center gap-2">
                                    <Package size={18} className="text-dark-red/70" />
                                    Live Tracking
                                    {trackingData && <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest ${trackingData.status.toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-red-50 text-dark-red'}`}>{trackingData.status}</span>}
                                </h3>
                                {order.awb && <p className="text-xs text-grey-beige font-mono tracking-wider">AWB: {order.awb}</p>}
                            </div>
                            <div className="p-6">
                                {isTrackingLoading ? (
                                    <div className="flex items-center justify-center py-8 text-gray-400">
                                        <RefreshCw className="animate-spin w-5 h-5 mr-3" /> Fetching live carrier updates...
                                    </div>
                                ) : trackingError ? (
                                    <div className="flex items-start gap-3 p-4 rounded bg-red-50 text-red-700 text-sm">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>{trackingError}</p>
                                    </div>
                                ) : trackingData?.timeline ? (
                                    <HorizontalTimeline timeline={trackingData.timeline} status={trackingData.status} />
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4">Timeline information is not yet available for this order.</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Main Column */}
                            <div className="lg:col-span-2 flex flex-col gap-6">

                                {/* Order Items Card */}
                                <div className="bg-white rounded-none shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white pointer-events-none">
                                        <div className="flex items-center gap-2 text-dark-red font-serif text-lg">
                                            Order Items ({order.items.length})
                                        </div>
                                    </div>
                                    <div className="p-0">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                                <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded flex-shrink-0 overflow-hidden">
                                                    {item.product?.images?.[0] ? (
                                                        <img 
                                                          loading="lazy"
                                                          src={item.product.images[0]} 
                                                          alt={item.product.name} 
                                                          className="w-full h-full object-contain p-1 mix-blend-multiply" 
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <a href="#" className="text-sm font-serif text-dark-red hover:text-ruby-red transition-colors truncate block">
                                                        {item.product?.name || 'Unknown Product'}
                                                    </a>
                                                    <p className="text-xs font-sans text-grey-beige mt-1 uppercase tracking-wider">{item.product?.category || 'Standard'}</p>
                                                </div>
                                                <div className="text-right text-sm font-sans text-gray-500">
                                                    {formatCurrency(item.priceAtPurchase)} × {item.quantity}
                                                </div>
                                                <div className="text-right text-sm font-sans font-semibold text-dark-red min-w-[80px]">
                                                    {formatCurrency(item.priceAtPurchase * item.quantity)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment / Summary Card */}
                                <div className="bg-white rounded-none shadow-sm border border-gray-200">
                                    <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                                        {order.paymentStatus === 'paid' ? (
                                            <CheckCircle2 size={18} className="text-green-600" />
                                        ) : (
                                            <Clock size={18} className="text-yellow-600" />
                                        )}
                                        <h3 className="text-lg font-serif text-dark-red">
                                            {order.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}
                                        </h3>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
                                            <span>Subtotal ({order.items.length} item{order.items.length > 1 ? 's' : ''})</span>
                                            <span className="text-gray-900">{formatCurrency(rawSubtotal)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
                                            <span>Discount {order.isWelcomeOfferApplied && <span className="text-xs text-green-600">(Welcome Offer)</span>}</span>
                                            <span className="text-gray-900">-{formatCurrency(rawDiscountAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
                                            <span>Shipping</span>
                                            <span className="text-gray-900">{rawShippingCost === 0 ? 'Free' : formatCurrency(rawShippingCost)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 text-sm text-gray-600">
                                            <span>Tax (Inclusive)</span>
                                            <span className="text-gray-900">{formatCurrency(rawTaxAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-4 mt-2 border-t border-gray-100 text-base font-serif text-dark-red">
                                            <span>Total</span>
                                            <div className="text-right">
                                                <span className="text-grey-beige font-sans text-xs tracking-widest uppercase mr-2 font-normal">{order.currency || 'INR'}</span>
                                                <span className="text-xl">{formatCurrency(rawTotalAmount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {order.paymentStatus === 'paid' && (
                                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                                            <div className="text-sm text-gray-600 flex justify-between items-center mb-1">
                                                <span>{order.paymentMethod === 'razorpay' ? 'Online' : 'COD'} transaction</span>
                                                <span className="font-mono text-xs text-gray-400">{order.razorpayPaymentId || 'Completed'}</span>
                                            </div>
                                            {order.refundId && (
                                                <div className="text-sm text-gray-600 flex flex-col justify-start items-start pt-2 border-t border-gray-200 mt-2">
                                                    <span className="font-semibold text-purple-700">Refund: {order.refundAmount ? formatCurrency(order.refundAmount) : '—'} ({order.refundStatus})</span>
                                                    <span className="font-mono text-[10px] text-gray-400">Refund Ref: {order.refundId}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Timeline Card */}
                                <div className="bg-white rounded-none shadow-sm border border-gray-200 p-6 print:hidden">
                                    <h3 className="text-lg font-serif text-dark-red mb-6">Timeline</h3>
                                    <div className="relative border-l border-gray-100 ml-3 space-y-6 pb-2">

                                        <div className="relative pl-6">
                                            <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-dark-red border-[3px] border-white ring-1 ring-dark-red"></div>
                                            <p className="text-sm font-sans font-medium text-gray-900">Order placed by {order.shippingDetails?.name || 'Customer'}</p>
                                            <p className="text-xs font-sans text-grey-beige mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                                        </div>

                                        {order.paymentStatus === 'paid' && (
                                            <div className="relative pl-6">
                                                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-dark-red border-[3px] border-white ring-1 ring-dark-red"></div>
                                                <p className="text-sm font-sans font-medium text-gray-900">Payment of {formatCurrency(rawTotalAmount)} was processed</p>
                                                <p className="text-xs font-sans text-grey-beige mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                                            </div>
                                        )}

                                        {order.awb && (
                                            <div className="relative pl-6">
                                                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-dark-red border-[3px] border-white ring-1 ring-dark-red"></div>
                                                <p className="text-sm font-sans font-medium text-gray-900">Shipping label created (AWB: {order.awb})</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Customer Notes Card */}
                                <div className="bg-white rounded-none shadow-sm border border-gray-200 p-6 print:hidden">
                                    <h3 className="text-lg font-serif text-dark-red mb-6 flex items-center gap-2">
                                        <MessageSquare size={20} className="text-dark-red/70" />
                                        Order Notes
                                        {comments.length > 0 && (
                                            <span className="ml-1 text-xs text-grey-beige font-sans font-normal">({comments.length})</span>
                                        )}
                                    </h3>

                                    {/* Existing Comments */}
                                    {comments.length > 0 && (
                                        <div className="space-y-4 mb-6">
                                            {[...comments].reverse().map((c, idx) => (
                                                <div key={idx} className="bg-neutral-50 border border-gray-100 p-4 rounded-none">
                                                    <p className="text-sm font-sans text-gray-800 leading-relaxed mb-1">{c.text}</p>
                                                    <p className="text-[11px] font-sans text-grey-beige">
                                                        {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* New Comment Input */}
                                    <div className="flex gap-3">
                                        <textarea
                                            rows={2}
                                            placeholder="Add a note (e.g. delivery instructions, special requests)…"
                                            className="flex-1 resize-none px-4 py-3 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors"
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            maxLength={1000}
                                        />
                                        <button
                                            onClick={handleAddComment}
                                            disabled={commentLoading || newComment.trim().length === 0 || comments.length >= 10}
                                            className="self-end px-5 py-3 bg-dark-red text-silk text-xs tracking-widest uppercase hover:bg-ruby-red transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                        >
                                            {commentLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                            {commentLoading ? '' : 'Post'}
                                        </button>
                                    </div>
                                    {comments.length >= 10 && (
                                        <p className="text-[11px] font-sans text-grey-beige mt-2 italic">Maximum 10 notes per order.</p>
                                    )}
                                </div>

                            </div>

                            {/* Right Sidebar */}
                            <div className="flex flex-col gap-6">

                                {/* Customer Details */}
                                <div className="bg-white rounded-none shadow-sm border border-gray-200 p-6 flex flex-col gap-5">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-serif text-dark-red">Contact & Address</h3>
                                    </div>

                                    <div>
                                        <p className="text-sm font-sans font-medium text-gray-900 block">{order.shippingDetails?.name}</p>
                                    </div>

                                    <div className="border-t border-gray-100 pt-3">
                                        <h4 className="text-xs uppercase tracking-widest font-sans text-grey-beige mb-3">Contact Information</h4>
                                        <a href={`mailto:${order.shippingDetails?.email || 'customer@example.com'}`} className="text-sm font-sans text-dark-red hover:text-ruby-red flex flex-col mb-1.5 break-all w-fit">
                                            {order.shippingDetails?.email || 'customer@example.com'}
                                        </a>
                                        <a href={`tel:${order.shippingDetails?.phone}`} className="text-sm font-sans text-gray-700 hover:text-dark-red flex flex-col">
                                            {order.shippingDetails?.phone}
                                        </a>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 relative">
                                        {isEditingAddress ? (
                                            <div className="space-y-4 bg-neutral-50 p-4 rounded-none border border-gray-100">
                                                <h4 className="text-xs uppercase tracking-widest font-sans text-dark-red">Edit Address</h4>
                                                <input type="text" placeholder="Full Name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                <input type="text" placeholder="Street Address" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                <div className="flex gap-3">
                                                    <input type="text" placeholder="City" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="w-1/2 px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                    <input type="text" placeholder="State" value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="w-1/2 px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                </div>
                                                <input type="text" placeholder="Pincode" value={editForm.pincode} onChange={e => setEditForm({ ...editForm, pincode: e.target.value })} className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                <input type="email" placeholder="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />
                                                <input type="tel" placeholder="Phone" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" />

                                                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                                                    <button onClick={() => setIsEditingAddress(false)} className="px-4 py-2 text-xs font-sans tracking-widest uppercase text-gray-600 bg-white border border-gray-200 hover:bg-neutral-50 transition-colors shadow-sm">Cancel</button>
                                                    <button onClick={handleSaveAddress} disabled={isSavingAddress} className="px-4 py-2 text-xs font-sans tracking-widest uppercase text-silk bg-dark-red hover:bg-ruby-red transition-colors shadow-sm">
                                                        {isSavingAddress ? 'Saving...' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-xs uppercase tracking-widest font-sans text-grey-beige">Shipping Address</h4>
                                                    {(order.orderStatus !== 'shipped' && order.orderStatus !== 'delivered') && (
                                                        <button onClick={() => setIsEditingAddress(true)} className="text-dark-red text-xs font-sans tracking-wider hover:text-ruby-red uppercase print:hidden">Edit</button>
                                                    )}
                                                </div>
                                                <p className="text-sm font-sans text-gray-800 leading-relaxed">
                                                    {order.shippingDetails?.name}<br />
                                                    {order.shippingDetails?.address}<br />
                                                    {order.shippingDetails?.city} - {order.shippingDetails?.pincode}<br />
                                                    {order.shippingDetails?.state}, India
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-100 pt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs uppercase tracking-widest font-sans text-grey-beige">Billing Address</h4>
                                        </div>
                                        <p className="text-sm font-sans text-gray-500 italic">Same as shipping address</p>
                                    </div>
                                </div>

                                {/* Conversion Summary */}

                            </div>
                        </div>

                    </div>
                </main>
            </div>

            {/* Cancel Modal */}
            {isCancelModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 print:hidden backdrop-blur-sm">
                    <div className="bg-white rounded p-6 max-w-sm w-full shadow-xl">
                        <h3 className="text-xl font-serif text-dark-red mb-3">Cancel Order</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to cancel this order? This action cannot be undone.
                        </p>
                        {order.paymentStatus === 'paid' && order.paymentMethod === 'razorpay' && (
                            <div className="mb-4 bg-purple-50 p-3 text-purple-800 text-xs border border-purple-100 rounded">
                                A refund of <strong>{formatCurrency(order.totalAmount)}</strong> will be initiated immediately to your original payment method. It may take 5-7 business days to reflect in your account.
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-2">
                            <button onClick={() => setIsCancelModalOpen(false)} disabled={isProcessingAction} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
                                Close
                            </button>
                            <button onClick={handleCancelOrder} disabled={isProcessingAction} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {isProcessingAction && <RefreshCw className="animate-spin w-3 h-3" />}
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Return Modal */}
            {isReturnModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 print:hidden backdrop-blur-sm">
                    <div className="bg-white rounded p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-serif text-dark-red mb-3">Return Order</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            We're sorry to see you return this order. Please tell us why you are returning the item(s).
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs uppercase tracking-widest font-sans text-grey-beige mb-2">Reason for Return</label>
                            <textarea 
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                rows={4}
                                placeholder="E.g. Item was damaged, didn't match description..."
                                className="w-full px-3 py-2 text-sm font-sans border border-gray-200 bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors" 
                            />
                        </div>
                        {order.paymentStatus === 'paid' && order.paymentMethod === 'razorpay' && (
                            <div className="mb-4 bg-purple-50 p-3 text-purple-800 text-xs border border-purple-100 rounded">
                                Upon successful return processing, a refund of <strong>{formatCurrency(order.totalAmount)}</strong> will be initiated to your original payment method.
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-2">
                            <button onClick={() => setIsReturnModalOpen(false)} disabled={isProcessingAction} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
                                Cancel
                            </button>
                            <button onClick={handleRequestReturn} disabled={isProcessingAction} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-white bg-dark-red hover:bg-ruby-red transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {isProcessingAction && <RefreshCw className="animate-spin w-3 h-3" />}
                                Submit Return Request
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <Footer />
        </div>
    );
}
