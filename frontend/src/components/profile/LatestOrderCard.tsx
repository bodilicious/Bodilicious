 
import { motion } from 'framer-motion';
import { Package, Truck, CheckCircle2, Clock, XCircle, ChevronRight, ShoppingBag } from 'lucide-react';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/currencies';

interface Props {
    order: Order | null;
    navigateTo: (page: any, pid?: string, orderId?: string) => void;
    onReorder: (order: Order) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
    pending:    { label: 'Order Placed',  color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
    processing: { label: 'Processing',   color: 'text-blue-600',  bg: 'bg-blue-50',  icon: Package },
    shipped:    { label: 'Shipped',      color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Truck },
    delivered:  { label: 'Delivered',    color: 'text-green-700', bg: 'bg-green-50', icon: CheckCircle2 },
    cancelled:  { label: 'Cancelled',    color: 'text-red-600',   bg: 'bg-red-50',   icon: XCircle },
};

export default function LatestOrderCard({ order, navigateTo, onReorder }: Props) {
    // Safety check for malformed order data (e.g., if it's just an ID string)
    if (typeof order !== 'object' || order === null || !order.items) {
        return (
            <div className="bg-white border border-silk rounded-2xl p-8 mb-6 text-center shadow-sm">
                <div className="w-14 h-14 bg-silk-light rounded-full flex items-center justify-center mx-auto mb-3">
                    <ShoppingBag size={22} className="text-silk" />
                </div>
                <h3 className="font-serif text-dark text-lg mb-1">Your skincare journey starts here</h3>
                <p className="font-sans text-grey-beige text-xs max-w-xs mx-auto mb-5">
                    Explore our bestsellers to build your ideal ritual.
                </p>
                <button
                    onClick={() => navigateTo('shop')}
                    className="bg-ruby-red text-white px-7 py-2.5 rounded-xl font-sans text-xs tracking-widest uppercase hover:bg-dark-red transition-all shadow-sm"
                >
                    Shop Bestsellers
                </button>
            </div>
        );
    }

    const status = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.pending;
    const StatusIcon = status.icon;
    const itemsCount = order.items?.length || 0;
    const firstTwoItems = order.items?.slice(0, 2) || [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-silk rounded-2xl overflow-hidden mb-8 shadow-sm hover:shadow-md transition-shadow"
        >
            <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <p className="font-sans text-[10px] uppercase tracking-widest text-grey-beige mb-1">Latest Order</p>
                        <h3 className="font-serif text-dark text-lg pr-4">Order #{order._id.slice(-8).toUpperCase()}</h3>
                        <p className="font-sans text-xs text-grey-beige">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-transparent ${status.bg} ${status.color} text-xs font-semibold`}>
                        <StatusIcon size={14} />
                        {status.label}
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="flex -space-x-3 overflow-hidden">
                        {firstTwoItems.map((item, idx) => (
                            <div key={idx} className="inline-block h-16 w-16 rounded-xl border-2 border-white bg-silk-light overflow-hidden shadow-sm">
                                <img
                                    loading="lazy"
                                    src={item.product?.images?.[0] || 'https://via.placeholder.com/150'}
                                    alt={item.product?.name || 'Product'}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ))}
                        {itemsCount > 2 && (
                            <div className="inline-block h-16 w-16 rounded-xl border-2 border-white bg-silk flex items-center justify-center text-grey-beige text-xs font-bold shadow-sm">
                                +{itemsCount - 2}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="font-sans text-sm text-dark font-medium leading-snug">
                            {order.items.length > 1 
                                ? `${order.items[0]?.product?.name || 'Product'} & ${order.items.length - 1} other item${order.items.length > 2 ? 's' : ''}`
                                : order.items[0]?.product?.name || 'Product'
                            }
                        </p>
                        <p className="font-sans text-xs text-grey-beige mt-0.5">Total Amount: {formatCurrency(order.totalAmount, order.currency)}</p>
                    </div>
                </div>

                {order.estimatedDeliveryDate && order.orderStatus !== 'delivered' && (
                    <div className="bg-silk-light/50 rounded-xl p-3 mb-6 flex items-center gap-3 border border-silk/30">
                        <Truck size={16} className="text-ruby-red" />
                        <p className="font-sans text-xs text-dark">
                            Expected delivery by <span className="font-bold">{new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
    onClick={() => navigateTo('order-details', undefined, order._id)}
    className="flex-1 flex items-center justify-center gap-2 bg-dark-red text-white px-6 py-3 rounded-xl font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all shadow-sm"
>
    Track Order <ChevronRight size={14} />
</button>
                    {order.orderStatus === 'delivered' && (
                        <button
                            onClick={() => onReorder(order)}
                            className="flex-1 flex items-center justify-center gap-2 border border-silk text-dark px-6 py-3 rounded-xl font-sans text-xs tracking-widest uppercase hover:bg-silk-light transition-all"
                        >
                            <ShoppingBag size={14} /> Reorder Favorites
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
