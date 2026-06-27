import { X, Package, Truck, CheckCircle, XCircle, RotateCcw, Clock, AlertCircle, ExternalLink } from 'lucide-react';
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
  admin:           { label: 'Admin',    color: 'bg-blue-100 text-blue-700' },
  system:          { label: 'System',   color: 'bg-gray-100 text-gray-600' },
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

  const history: TimelineEntry[] = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: order.orderStatus, changedAt: order.createdAt, source: 'system', note: 'Order created' }];

  const getStatusStep = (status: string) =>
    STATUS_STEPS.find(s => s.key === status);

  const hasShiprocketData = !!(order.shiprocketOrderId || order.awb || order.shipmentId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Order Timeline</h2>
            <p className="text-xs text-gray-500 mt-0.5">#{order._id.slice(-8).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Order summary */}
        <div className={`px-6 py-4 bg-gray-50 border-b border-gray-100 grid ${order.billingDetails ? 'grid-cols-4' : 'grid-cols-3'} gap-4 text-sm`}>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Customer</p>
            <p className="font-medium text-gray-800">{order.shippingDetails.name}</p>
            <p className="text-gray-500 text-xs">{order.shippingDetails.phone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
            <p className="font-medium text-gray-800">{formatCurrency(order.totalAmount, order.currency)}</p>
            <p className="text-gray-500 text-xs capitalize">{order.paymentMethod} · {order.paymentStatus}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Shipping</p>
            <p className="font-medium text-gray-800 text-xs leading-snug">
              {order.shippingDetails.address},<br />
              {order.shippingDetails.city}, {order.shippingDetails.state} {order.shippingDetails.pincode}
            </p>
          </div>
          {order.billingDetails && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Billing</p>
              <p className="font-medium text-gray-800 text-xs leading-snug">
                {order.billingDetails.name}<br />
                {order.billingDetails.address},<br />
                {order.billingDetails.city}, {order.billingDetails.state} {order.billingDetails.pincode}<br />
                {order.billingDetails.country && <span className="text-gray-500">{order.billingDetails.country}</span>}
              </p>
            </div>
          )}
        </div>

        {/* Payment & Refund Block */}
        {(order.paymentStatus === 'refunded' || order.refundId) && (
          <div className="px-6 py-4 border-b border-gray-100 bg-purple-50/30">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw size={14} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-purple-900">Refund Details</h3>
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-0.5">Refund Status</p>
                <span className="font-medium text-purple-700 text-xs capitalize">{order.refundStatus || '—'}</span>
              </div>
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-0.5">Refund Amount</p>
                <span className="font-medium text-purple-700 text-xs">{order.refundAmount ? formatCurrency(order.refundAmount, order.currency) : '—'}</span>
              </div>
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-0.5">Refund ID</p>
                <span className="font-mono text-purple-700 text-xs">{order.refundId || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Shiprocket Info Block */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-700">Shiprocket</h3>
          </div>
          {hasShiprocketData ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">AWB Number</p>
                {order.awb ? (
                  <span className="font-mono text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">
                    {order.awb}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs italic">Pending assignment</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Shiprocket Order ID</p>
                <p className="font-medium text-gray-700 text-xs">
                  {order.shiprocketOrderId ? (
                    <a
                      href={`https://app.shiprocket.in/orders/details/${order.shiprocketOrderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:underline inline-flex items-center gap-1"
                    >
                      {order.shiprocketOrderId} <ExternalLink size={10} />
                    </a>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Shipment ID</p>
                <p className="font-medium text-gray-700 text-xs">{order.shipmentId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Courier</p>
                <p className="font-medium text-gray-700 text-xs">{order.estimatedCourierName || '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Est. Delivery Date</p>
                <p className="font-medium text-gray-700 text-xs">
                  {order.estimatedDeliveryDate
                    ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', { dateStyle: 'long' })
                    : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Not yet synced with Shiprocket. Use the "Push" button in the orders table to push this order.
            </p>
          )}
        </div>

        {/* Customer Comments — read-only for admin */}
        {(order.customerComments?.length ?? 0) > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Customer Notes</h3>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium border border-blue-100">
                {order.customerComments!.length}
              </span>
            </div>
            <div className="space-y-2">
              {[...order.customerComments!].reverse().map((c, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-sm text-gray-800 leading-relaxed">{c.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="px-6 py-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status History</h3>

          {history.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <AlertCircle size={40} className="mb-3 opacity-50" />
              <p className="text-sm">No status history recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-5 bottom-5 w-px bg-gray-200" />

              <div className="space-y-6">
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
                    <div key={idx} className="flex gap-4 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm z-10 ${isLatest ? 'bg-dark-red text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 pt-1.5 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${isLatest ? 'text-dark-red' : 'text-gray-700'}`}>
                            {step?.label || entry.status}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${srcBadge.color}`}>
                            {srcBadge.label}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Current</span>
                          )}
                        </div>
                        {ts && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            {actorName && <> · by <span className="text-gray-600">{actorName}</span></>}
                          </p>
                        )}
                        {entry.note && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{entry.note}"</p>
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
  );
}
