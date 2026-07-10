import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Package, ArrowLeft, AlertCircle, RefreshCw, Calendar, CreditCard, FileText, MessageSquare, Send } from 'lucide-react';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { Order, TimelineEvent } from '../types';
import { formatCurrency } from '../utils/currencies';
import { useSEO } from '../hooks/useSEO';


export default function TrackingPage() {
    useSEO({
        title: 'Track Your Order',
        description: 'Track the status of your order.',
        noIndex: true
    });

    const { navigateTo, getAuthHeaders, orders, cancelOrder } = useApp();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    
    const [trackingData, setTrackingData] = useState<{
        status: string;
        expectedDelivery: string;
        timeline: TimelineEvent[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Comments state
    const [comments, setComments] = useState<{ text: string; createdAt: string }[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    // Sync comments when selected order changes
    useEffect(() => {
        if (selectedOrder) {
            setComments((selectedOrder as any).customerComments || []);
        } else {
            setComments([]);
        }
    }, [selectedOrder]);

    useEffect(() => {
        // Fetch tracking when an order is selected
        if (selectedOrder) {
            // Check if selected order still exists
            const exists = orders.find(o => o._id === selectedOrder._id);
            if (!exists) {
                setSelectedOrder(null);
                setTrackingData(null);
                return;
            }
            fetchTracking(selectedOrder);
        } else {
            setTrackingData(null);
            setError('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrder]);

    const handleAddComment = async () => {
        if (!selectedOrder || newComment.trim().length === 0) return;
        setCommentLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/v1/orders/${selectedOrder._id}/comment`,
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

    const fetchTracking = async (order: Order) => {
        setIsLoading(true);
        setError('');
        setTrackingData(null);

        try {
            if (!order.awb) {
                // If no AWB, show generic timeline based on db status
                if (order.orderStatus === 'cancelled') {
                    setTrackingData({
                        status: 'Cancelled',
                        expectedDelivery: 'N/A',
                        timeline: [
                            { status: 'Order Confirmed', location: 'System', date: new Date(order.createdAt).toLocaleDateString(), completed: true },
                            { status: 'Cancelled', location: 'System', date: '', completed: true }
                        ]
                    });
                    return;
                }

                setTrackingData({
                    status: order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1),
                    expectedDelivery: 'Soon',
                    timeline: [
                        { status: 'Order Confirmed', location: 'System', date: new Date(order.createdAt).toLocaleDateString(), completed: true },
                        { status: 'Processing', location: 'Warehouse', date: '', completed: false },
                        { status: 'Shipped', location: '', date: '', completed: false },
                        { status: 'Out for Delivery', location: '', date: '', completed: false },
                        { status: 'Delivered', location: '', date: '', completed: false }
                    ]
                });
                return;
            }

            const headers = await getAuthHeaders();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/orders/shiprocket/${order.awb}`, {
                headers
            });

            const data = await res.json();

            if (!res.ok) {
                // Handle cancelled or failed orders internally if Shiprocket throws an error
                if (order.orderStatus === 'cancelled') {
                    setTrackingData({
                        status: 'Cancelled',
                        expectedDelivery: 'N/A',
                        timeline: [
                            { status: 'Order Confirmed', location: 'System', date: new Date(order.createdAt).toLocaleDateString(), completed: true },
                            { status: 'Cancelled', location: 'System', date: '', completed: true }
                        ]
                    });
                    return;
                }
                throw new Error(data.message || 'Failed to fetch tracking details');
            }

            setTrackingData(data.data);
        } catch (err: any) {
            setError(err.message || 'An error occurred while tracking your order');
            // Show fallback timeline on error
            setTrackingData({
                status: order.orderStatus,
                expectedDelivery: 'Pending',
                timeline: [
                    { status: 'Order Confirmed', location: 'System', date: new Date(order.createdAt).toLocaleDateString(), completed: true },
                    { status: 'Pending Tracking Update', location: '', date: '', completed: false }
                ]
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelOrder = () => {
        setIsCancelModalOpen(true);
    };

    const confirmCancelOrder = async () => {
        if (!selectedOrder) return;
        setIsCancelling(true);
        try {
            await cancelOrder(selectedOrder._id);
            // Update local order state to show it's cancelled immediately
            setSelectedOrder(prev => prev ? { ...prev, orderStatus: 'cancelled' } : null);
            setTrackingData(prev => prev ? { ...prev, status: 'Cancelled' } : null);
            toast.success('Order cancelled successfully');
            setIsCancelModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to cancel order');
        } finally {
            setIsCancelling(false);
        }
    };


    // Horizontal Progress view component
    const HorizontalTimeline = ({ timeline, status }: { timeline: TimelineEvent[], status: string }) => {
        const isErrorState = status.toLowerCase() === 'cancelled' || status.toLowerCase().includes('fail');
        const activeColor = isErrorState ? 'bg-red-500' : 'bg-[#e77600]'; // Amazon orange

        return (
            <div className="w-full mb-16 mt-8 hidden sm:block">
                <div className="relative flex justify-between items-center mb-8 px-4">
                    {/* Background line */}
                    <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-gray-200 -z-10"></div>

                    {/* Active line */}
                    {timeline.length > 0 && (
                        <div
                            className={`absolute left-4 top-1/2 -translate-y-1/2 h-1 ${activeColor} -z-10 transition-all duration-500`}
                            style={{
                                width: `calc(${(timeline.filter(t => t.completed).length - 1) / (timeline.length - 1) * 100}% - 2rem)`
                            }}
                        ></div>
                    )}

                    {timeline.map((event, idx) => (
                        <div key={idx} className="relative flex flex-col items-center z-10">
                            <div className={`w-5 h-5 rounded-full border-4 ${event.completed ? activeColor + ' border-' + activeColor : 'bg-gray-200 border-gray-200'} transition-colors duration-500`}></div>
                            <div className="absolute top-8 w-24 text-center">
                                <p className={`text-xs font-semibold ${event.completed ? 'text-gray-900' : 'text-gray-400'}`}>{event.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!orders || orders.length === 0) {
        return (
            <div className="min-h-screen bg-white flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <Package className="w-16 h-16 text-silk mb-4" />
                    <h2 className="font-serif text-dark-red text-2xl mb-2">No Orders Found</h2>
                    <p className="font-sans text-grey-beige mb-6">Looks like you haven't placed any orders yet.</p>
                    <button
                        onClick={() => navigateTo('shop')}
                        className="bg-dark-red text-silk px-8 py-3 font-sans text-sm tracking-widest uppercase hover:bg-ruby-red transition-colors"
                    >
                        Start Shopping
                    </button>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-24 pb-16 flex flex-col lg:flex-row gap-6">

                {/* Left Sidebar - Order List */}
                <div className="w-full lg:w-1/3 flex flex-col gap-4">
                    <button
                        onClick={() => navigateTo('account')}
                        className="flex items-center gap-2 text-sm text-grey-beige hover:text-dark-red transition-colors mb-2 font-sans"
                    >
                        <ArrowLeft size={16} /> Back to Account
                    </button>
                    <h1 className="font-serif text-dark-red text-3xl mb-2">Your Orders</h1>

                    <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-2 pb-8">
                        {[...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                            <div
                                key={order._id}
                                onClick={() => setSelectedOrder(order)}
                                className={`p-4 border rounded-md cursor-pointer transition-all shadow-sm ${selectedOrder?._id === order._id ? 'border-dark-red bg-red-50/30 ring-1 ring-dark-red' : 'border-gray-200 bg-white hover:border-dark-red/50 hover:shadow-md'} flex gap-4`}
                            >
                                <div className="w-16 h-16 bg-gray-100 flex-shrink-0 rounded overflow-hidden">
                                    {order.items[0]?.product?.images?.[0] && (
                                        <img 
                                          loading="lazy"
                                          src={order.items[0].product.images[0]} 
                                          alt="" 
                                          className="w-full h-full object-contain p-1 mix-blend-multiply" 
                                        />
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <p className="font-sans text-xs text-gray-500 mb-1">
                                        Ordered on {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                    <p className="font-serif text-dark-red text-sm line-clamp-2 mb-1 leading-snug">
                                        {order.items[0]?.product?.name} {order.items.length > 1 ? `+ ${order.items.length - 1} more item(s)` : ''}
                                    </p>
                                    <p className="font-sans text-xs font-semibold text-gray-900 mt-auto">
                                        {formatCurrency(order.totalAmount, order.currency)}
                                    </p>
                                    {order.estimatedDeliveryDate && ['pending', 'processing', 'shipped'].includes(order.orderStatus.toLowerCase()) && (
                                        <p className="font-sans text-[11px] text-[#e77600] mt-1 font-medium">
                                            Est. Delivery: {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Content - Tracking View */}
                <div className="w-full lg:w-2/3">
                    {selectedOrder ? (
                        <div className="border border-gray-200 rounded-lg p-6 sm:p-8 bg-white h-auto sm:h-full relative shadow-sm">
                            {/* Header Status Phase */}
                            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className={`font-sans font-bold text-2xl mb-1 ${trackingData?.status.toLowerCase() === 'cancelled' ? 'text-red-600' : 'text-[#e77600]'}`}>
                                        {trackingData?.status || "Processing"}
                                    </h2>
                                    <p className="font-sans text-gray-700 text-sm">
                                        Expected delivery: <span className="font-semibold text-green-700">{trackingData?.expectedDelivery || 'Pending'}</span>
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    <button
                                        onClick={() => navigateTo('order-details', undefined, selectedOrder._id)}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-md transition-colors shadow-sm"
                                    >
                                        <FileText size={16} /> View Details
                                    </button>
                                    {selectedOrder.orderStatus !== 'cancelled' && selectedOrder.orderStatus !== 'delivered' && selectedOrder.orderStatus !== 'shipped' && (
                                        <button
                                            onClick={handleCancelOrder}
                                            disabled={isCancelling}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors w-full sm:w-auto justify-center"
                                        >
                                            <AlertCircle size={16} /> {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                                        </button>
                                    )}
                                    
                                </div>
                            </div>

                            {/* Order Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-gray-50 border border-gray-100 p-4 rounded-md">
                                <div>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                        <FileText size={12} /> Transaction ID
                                    </div>
                                    <p className="font-mono text-xs font-semibold text-gray-900 break-all">{selectedOrder._id}</p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                        <Calendar size={12} /> Date Placed
                                    </div>
                                    <p className="font-sans text-sm font-semibold text-gray-900">
                                        {new Date(selectedOrder.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                        <CreditCard size={12} /> Total Amount
                                    </div>
                                    <p className="font-sans text-sm font-semibold text-gray-900">
                                        {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                        <RefreshCw size={12} /> Payment Status
                                    </div>
                                    <p className="font-sans text-sm font-semibold capitalize text-gray-900">
                                        {selectedOrder.paymentStatus}
                                    </p>
                                </div>
                            </div>

                            {/* Horizontal Tracker for larger screens */}
                            {trackingData?.timeline && (
                                <HorizontalTimeline timeline={trackingData.timeline} status={trackingData.status} />
                            )}

                            {/* Products summary inline relative to amazon view */}
                            <div className="flex items-center gap-4 mb-6 pt-6 border-t border-gray-100">
                                <div className="flex -space-x-3">
                                    {selectedOrder.items.slice(0, 3).map((item, idx) => {
                                        if (!item.product?.images?.[0]) return null;
                                        return (
                                            <div key={idx} className="w-14 h-14 rounded-full border-2 border-white overflow-hidden bg-gray-100 shrink-0 relative z-[1]">
                                                <img 
                                                  loading="lazy"
                                                  src={item.product.images[0]} 
                                                  alt="" 
                                                  className="w-full h-full object-contain p-1 mix-blend-multiply" 
                                                />
                                            </div>
                                        );
                                    })}
                                    {selectedOrder.items.length > 3 && (
                                        <div className="w-14 h-14 rounded-full border-2 border-white overflow-hidden bg-gray-100 shrink-0 relative z-[1] flex items-center justify-center font-sans text-xs text-gray-500">
                                            +{selectedOrder.items.length - 3}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="font-sans text-sm text-gray-700">
                                        <strong>{selectedOrder.items.length} item{selectedOrder.items.length > 1 ? 's' : ''}</strong> in this shipment
                                    </p>
                                    {selectedOrder.awb && (
                                        <p className="font-sans text-xs text-gray-500 mt-1">AWB: {selectedOrder.awb}</p>
                                    )}
                                </div>
                            </div>

                            {/* Detailed List tracking breakdown */}
                            <div className="bg-gray-50 rounded-md p-5 border border-gray-200 mt-8">
                                <h3 className="font-sans font-bold text-sm text-gray-900 mb-4 pb-2 border-b border-gray-200">Tracking Details:</h3>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8 text-gray-400">
                                        <RefreshCw className="animate-spin w-5 h-5 mr-3" /> Loading tracking...
                                    </div>
                                ) : error ? (
                                    <div className="flex items-start gap-3 p-3 rounded bg-red-50 border border-red-100 text-red-700 text-sm">
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                ) : trackingData?.timeline && trackingData.timeline.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Reversing timeline so newest is at the top */}
                                        {[...trackingData.timeline].reverse().filter(t => t.completed).map((event, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row gap-1 sm:gap-6 text-sm font-sans">
                                                <div className="w-48 text-gray-600 shrink-0">
                                                    {event.date}
                                                    {event.location && <span className="block text-gray-500 text-xs">{event.location}</span>}
                                                </div>
                                                <div className="text-gray-900">
                                                    {event.status}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No detailed tracking information is available yet.</p>
                                )}
                            </div>

                            {/* Customer Notes / Comments */}
                            <div className="mt-8 border-t border-gray-100 pt-6">
                                <h3 className="font-sans font-bold text-sm text-gray-900 mb-4 flex items-center gap-2">
                                    <MessageSquare size={16} className="text-dark-red" />
                                    Leave a Note
                                    {comments.length > 0 && (
                                        <span className="ml-1 text-xs text-gray-400 font-normal">({comments.length})</span>
                                    )}
                                </h3>

                                {/* Existing comments — newest first */}
                                {comments.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {[...comments].reverse().map((c, idx) => (
                                            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-md p-3">
                                                <p className="text-sm text-gray-800 leading-relaxed">{c.text}</p>
                                                <p className="text-[11px] text-gray-400 mt-1">
                                                    {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* New comment input */}
                                <div className="flex gap-2">
                                    <textarea
                                        rows={2}
                                        placeholder="Add a note (e.g. leave at door, call before delivery)…"
                                        className="flex-1 resize-none px-3 py-2 text-sm font-sans border border-gray-200 rounded-md bg-white focus:border-dark-red focus:ring-0 outline-none transition-colors"
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        maxLength={1000}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddComment();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        disabled={commentLoading || newComment.trim().length === 0 || comments.length >= 10}
                                        className="self-end px-4 py-2 bg-dark-red text-white text-sm rounded-md hover:bg-ruby-red transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {commentLoading
                                            ? <RefreshCw size={14} className="animate-spin" />
                                            : <Send size={14} />
                                        }
                                    </button>
                                </div>
                                {comments.length >= 10 && (
                                    <p className="text-xs text-gray-400 mt-1 italic">Maximum 10 notes per order reached.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded-lg p-8 bg-white h-full flex items-center justify-center text-center shadow-sm min-h-[400px]">
                            <div>
                                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="font-sans text-gray-500">Select an order from the list to track its shipment.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Cancel Modal */}
            {isCancelModalOpen && selectedOrder && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 print:hidden backdrop-blur-sm">
                    <div className="bg-white rounded p-6 max-w-sm w-full shadow-xl">
                        <h3 className="text-xl font-serif text-dark-red mb-3">Cancel Order</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to cancel this order? This action cannot be undone.
                        </p>
                        {selectedOrder.paymentStatus === 'paid' && selectedOrder.paymentMethod === 'razorpay' && (
                            <div className="mb-4 bg-purple-50 p-3 text-purple-800 text-xs border border-purple-100 rounded">
                                A refund of <strong>{formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}</strong> will be initiated immediately to your original payment method. It may take 5-7 business days to reflect in your account.
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-2">
                            <button onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
                                Close
                            </button>
                            <button onClick={confirmCancelOrder} disabled={isCancelling} className="w-full sm:w-auto px-4 py-2 text-xs font-sans tracking-widest uppercase text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {isCancelling && <RefreshCw className="animate-spin w-3 h-3" />}
                                Confirm Cancel
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
