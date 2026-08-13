import { X, Package, Truck, CheckCircle, XCircle, RotateCcw, Clock, AlertCircle, ExternalLink, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';

const STATUS_STEPS = [
  { key: 'pending',          label: 'Order Placed',       icon: Clock },
  { key: 'processing',       label: 'Payment Confirmed',  icon: CheckCircle },
  { key: 'shipped',          label: 'Shipped',             icon: Truck },
  { key: 'delivered',        label: 'Delivered',           icon: Package },
  { key: 'cancelled',        label: 'Cancelled',           icon: XCircle },
  { key: 'return_requested', label: 'Return Requested',    icon: RotateCcw },
  { key: 'returned',         label: 'Returned',            icon: RotateCcw },
];

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  admin:           { label: 'Admin',    color: 'bg-slate-100 text-slate-700' },
  system:          { label: 'System',   color: 'bg-slate-100 text-slate-600' },
  shiprocket:      { label: 'Shiprocket', color: 'bg-orange-100 text-orange-700' },
  payment_gateway: { label: 'Payment',  color: 'bg-green-100 text-green-700' },
};

interface TimelineEntry {
  status: string;
  changedAt?: string;
  timestamp?: string;
  changedBy?: { name?: string } | string;
  source?: string;
  note?: string;
}

interface Order {
  _id: string;
  orderStatus: string;
  currency?: string;
  shippingDetails: { name: string; address: string; city: string; state: string; pincode: string; phone: string; email?: string };
  billingDetails?: { name: string; address: string; city: string; state: string; pincode: string; country?: string } | null;
  items?: any[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  statusHistory?: TimelineEntry[];
  createdAt: string;
  // Shiprocket fields
  awb?: string | null;
  shipmentId?: number | null;
  shiprocketOrderId?: string | null;
  estimatedCourierName?: string | null;
  estimatedDeliveryDate?: string | null;
  // Customer comments
  customerComments?: { text: string; createdAt: string }[];
  refundId?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
}

interface Props {
  order: Order | null;
  onClose: () => void;
}

export default function OrderTimelineModal({ order, onClose }: Props) {
  if (!order) return null;

  const API_URL = import.meta.env.VITE_API_URL || '';

  const history: TimelineEntry[] = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: order.orderStatus, changedAt: order.createdAt, source: 'system', note: 'Order created' }];

  const getStatusStep = (status: string) =>
    STATUS_STEPS.find(s => s.key === status);

  const hasShiprocketData = !!(order.shiprocketOrderId || order.awb || order.shipmentId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Slate Theme */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Order Details</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">#{order._id.slice(-8).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            <X size={18} className="text-slate-300" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Order Summary Grid */}
          <div className={`px-6 py-5 border-b border-slate-200 grid ${order.billingDetails ? 'grid-cols-4' : 'grid-cols-3'} gap-6 text-sm bg-slate-50/50`}>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Customer</p>
              <p className="font-medium text-slate-900">{order.shippingDetails.name}</p>
              <p className="text-slate-500 text-xs mt-0.5 font-mono">{order.shippingDetails.phone}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Total</p>
              <p className="font-mono font-medium text-slate-900">{formatCurrency(order.totalAmount, order.currency)}</p>
              <p className="text-slate-500 text-[11px] font-medium uppercase mt-0.5 tracking-wide">{order.paymentMethod} · {order.paymentStatus}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Shipping</p>
              <p className="font-medium text-slate-700 text-xs leading-relaxed">
                {order.shippingDetails.address},<br />
                {order.shippingDetails.city}, {order.shippingDetails.state} {order.shippingDetails.pincode}
              </p>
            </div>
            {order.billingDetails && (
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Billing</p>
                <p className="font-medium text-slate-700 text-xs leading-relaxed">
                  {order.billingDetails.name}<br />
                  {order.billingDetails.address},<br />
                  {order.billingDetails.city}, {order.billingDetails.state} {order.billingDetails.pincode}<br />
                  {order.billingDetails.country && <span className="text-slate-400">{order.billingDetails.country}</span>}
                </p>
              </div>
            )}
          </div>

          {/* Purchased Items Section */}
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={14} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Purchased Items</h3>
            </div>
            
            {order.items && order.items.length > 0 ? (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, idx) => {
                      const product = item.product || {};
                      const isPopulated = typeof product === 'object' && product.name;
                      const pName = isPopulated ? product.name : `Product ID: ${item.product}`;
                      const getImageUrl = (path: string) => {
                        if (!path) return null;
                        if (path.startsWith('http')) return path;
                        const cleanPath = path.replace(/\\/g, '/').replace(/^\//, '');
                        return `${API_URL}/${cleanPath}`;
                      };
                      const pImage = isPopulated && product.images?.[0] ? getImageUrl(product.images[0]) : null;
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-3 whitespace-normal min-w-[250px]">
                            {pImage ? (
                              <img src={pImage} alt={pName} className="w-10 h-10 object-cover rounded shadow-sm border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center border border-slate-200 shrink-0">
                                <Package size={14} className="text-slate-400" />
                              </div>
                            )}
                            <div>
                              {isPopulated && product.slug ? (
                                <a href={`/shop/product/${product.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 text-sm hover:text-blue-600 transition-colors">
                                  {pName}
                                </a>
                              ) : (
                                <p className="font-medium text-slate-900 text-sm">{pName}</p>
                              )}
                              {isPopulated && product.pid && <p className="font-mono text-[10px] text-slate-400 mt-0.5">{product.pid}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.variant ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.variant}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCurrency(item.priceAtPurchase || (isPopulated ? product.price : 0), order.currency)}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                            {formatCurrency((item.priceAtPurchase || (isPopulated ? product.price : 0)) * item.quantity, order.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                <p className="text-sm text-slate-500">No item details available.</p>
              </div>
            )}
          </div>

          {/* Payment & Refund Block */}
          {(order.paymentStatus === 'refunded' || order.refundId) && (
            <div className="px-6 py-5 border-b border-slate-200 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-4">
                <RotateCcw size={14} className="text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-900 tracking-tight">Refund Details</h3>
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <p className="text-[11px] text-emerald-600/70 uppercase tracking-wider font-semibold mb-1">Status</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 capitalize">
                    {order.refundStatus || '—'}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-600/70 uppercase tracking-wider font-semibold mb-1">Amount</p>
                  <span className="font-mono font-medium text-emerald-800">{order.refundAmount ? formatCurrency(order.refundAmount, order.currency) : '—'}</span>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-600/70 uppercase tracking-wider font-semibold mb-1">Refund ID</p>
                  <span className="font-mono text-emerald-800 bg-emerald-100/50 px-2 py-0.5 rounded border border-emerald-200">{order.refundId || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shiprocket Info Block */}
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/30">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={14} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Logistics (Shiprocket)</h3>
            </div>
            {hasShiprocketData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">AWB Number</p>
                  {order.awb ? (
                    <span className="font-mono text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                      {order.awb}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Pending assignment</span>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Order ID</p>
                  <p className="font-medium text-slate-800 text-xs">
                    {order.shiprocketOrderId ? (
                      <a
                        href={`https://app.shiprocket.in/orders/details/${order.shiprocketOrderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 transition-colors"
                      >
                        <span className="font-mono">{order.shiprocketOrderId}</span> <ExternalLink size={12} />
                      </a>
                    ) : '—'}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Courier</p>
                  <p className="font-medium text-slate-800 text-sm">{order.estimatedCourierName || '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Est. Delivery</p>
                  <p className="font-medium text-slate-800 text-sm">
                    {order.estimatedDeliveryDate
                      ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                      : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-3 px-4 bg-white rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                <AlertCircle size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Not yet synced with Shiprocket. Use the <span className="font-semibold text-slate-700">Push</span> button in the orders table to sync this order and generate an AWB.
                </p>
              </div>
            )}
          </div>

          {/* Customer Comments */}
          {(order.customerComments?.length ?? 0) > 0 && (
            <div className="px-6 py-5 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Customer Notes</h3>
                  <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">
                    {order.customerComments!.length}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {[...order.customerComments!].reverse().map((c, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 rounded-l-lg"></div>
                    <p className="text-sm text-slate-800 leading-relaxed pl-2">{c.text}</p>
                    <p className="text-[11px] text-slate-400 mt-2 font-mono pl-2">
                      {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline History */}
          <div className="px-6 py-6 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-6">Status History</h3>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white">
                <AlertCircle size={32} className="mb-3 text-slate-300" />
                <p className="text-sm">No status history recorded yet</p>
              </div>
            ) : (
              <div className="relative pl-2">
                {/* Vertical Timeline Line */}
                <div className="absolute left-[21px] top-4 bottom-4 w-[2px] bg-slate-200 rounded-full" />

                <div className="space-y-8">
                  {history.map((entry, idx) => {
                    const step = getStatusStep(entry.status);
                    const Icon = step?.icon || Clock;
                    const isLatest = idx === history.length - 1;
                    const ts = entry.changedAt || entry.timestamp;
                    const src = entry.source || 'system';
                    const srcBadge = SOURCE_BADGE[src] || SOURCE_BADGE.system;
                    const actorName = typeof entry.changedBy === 'object'
                      ? (entry.changedBy as any)?.name
                      : null;

                    return (
                      <div key={idx} className="flex gap-5 relative group">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-colors shadow-sm
                          ${isLatest 
                            ? 'bg-emerald-500 text-white ring-4 ring-emerald-50' 
                            : 'bg-white border-2 border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-500'}`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 pt-1.5 pb-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className={`text-sm font-semibold tracking-tight ${isLatest ? 'text-slate-900' : 'text-slate-600'}`}>
                              {step?.label || entry.status}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${srcBadge.color} border border-transparent`}>
                              {srcBadge.label}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                Current
                              </span>
                            )}
                          </div>
                          {ts && (
                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              {new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              {actorName && <span className="ml-1 text-slate-400">· by <span className="text-slate-700 font-sans font-medium">{actorName}</span></span>}
                            </p>
                          )}
                          {entry.note && (
                            <div className="mt-2.5 p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                              <p className="text-xs text-slate-600 leading-relaxed"><span className="font-semibold text-slate-400 mr-1">Note:</span>{entry.note}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
