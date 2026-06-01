import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, CheckCircle, XCircle, Package, ChevronDown, ChevronUp, TrendingDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import Select from '../components/Select';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const REASON_LABELS: Record<string, string> = {
  damaged: 'Damaged / Defective',
  wrong_item: 'Wrong Item',
  changed_mind: 'Changed Mind',
  not_as_described: 'Not as Described',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

const REJECTION_PRESETS = [
  'Outside return window',
  'No proof of damage',
  'Policy violation',
  'Item not in original condition',
  'Non-returnable product',
];

// Removed local authHeaders, using useApp().getAuthHeaders instead

interface ReturnOrder {
  _id: string;
  shippingDetails: { name: string; email: string; phone: string; address: string; city: string; state: string };
  returnStatus: string;
  returnReason: string;
  returnConditionNotes: string;
  returnPhotoUrls: string[];
  returnRequestedAt: string;
  returnRefundMethod: string;
  physicalReceived: boolean;
  totalAmount: number;
  items: Array<{ product: { name: string; pid: string; images: string[] }; quantity: number; priceAtPurchase: number }>;
}

interface Analytics {
  topSkus: Array<{ name: string; pid: string; returnCount: number; unitsSold: number; returnRate: number; topReason: string; category: string }>;
  byCategory: Array<{ category: string; returnCount: number; unitsSold: number; returnRate: number }>;
}

const ReturnsManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [orders, setOrders] = useState<ReturnOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Action modals
  const [approveModal, setApproveModal] = useState<{ open: boolean; orderId: string; refundMethod: string }>({ open: false, orderId: '', refundMethod: 'original_payment' });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; orderId: string; reason: string }>({ open: false, orderId: '', reason: '' });
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) params.set('status', statusFilter);
      if (reasonFilter) params.set('reason', reasonFilter);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/returns?${params}`, { headers });
      const d = await r.json();
      if (d.success) { setOrders(d.data); setTotal(d.total); }
    } catch { toast.error('Failed to load returns'); }
    finally { setLoading(false); }
  }, [page, statusFilter, reasonFilter, getAuthHeaders]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const fetchAnalytics = async () => {
    if (analytics) { setShowAnalytics(!showAnalytics); return; }
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/returns/analytics`, { headers });
      const d = await r.json();
      if (d.success) { setAnalytics(d.data); setShowAnalytics(true); }
    } catch { toast.error('Failed to load analytics'); }
  };

  const handleApprove = async () => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/returns/${approveModal.orderId}/approve`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ refundMethod: approveModal.refundMethod }),
      });
      const d = await r.json();
      if (d.success) { toast.success('Return approved — confirmation email sent'); fetchQueue(); }
      else toast.error(d.message);
    } catch { toast.error('Approve failed'); }
    finally { setApproveModal({ open: false, orderId: '', refundMethod: 'original_payment' }); }
  };

  const handleReject = async () => {
    if (!rejectModal.reason.trim()) { toast.error('Rejection reason is required'); return; }
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/returns/${rejectModal.orderId}/reject`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ rejectionReason: rejectModal.reason }),
      });
      const d = await r.json();
      if (d.success) { toast.success('Return rejected — customer notified by email'); fetchQueue(); }
      else toast.error(d.message);
    } catch { toast.error('Reject failed'); }
    finally { setRejectModal({ open: false, orderId: '', reason: '' }); }
  };

  const handleMarkReceived = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/returns/${id}/received`, { method: 'PATCH', headers });
      const d = await r.json();
      if (d.success) { toast.success('Marked as received' + (d.restockLog?.length ? ' — stock updated' : '')); fetchQueue(); }
      else toast.error(d.message);
    } catch { toast.error('Failed to mark as received'); }
    finally { setConfirmReceiveId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <RotateCcw size={22} className="text-dark-red" /> Returns Queue
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total requests</p>
        </div>
        <button onClick={fetchAnalytics} className="flex items-center gap-2 px-4 py-2 bg-silk-light hover:bg-silk text-dark-red rounded-xl text-sm font-medium transition-all">
          <TrendingDown size={16} /> {showAnalytics ? 'Hide Analytics' : 'View Return Analytics'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {['', 'requested', 'approved', 'rejected', 'completed'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${statusFilter === s ? 'bg-dark-red text-white border-dark-red' : 'bg-silk-light/50 text-grey-beige border-transparent hover:border-silk'}`}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Statuses'}
          </button>
        ))}
        <Select
          className="w-48"
          value={reasonFilter}
          onChange={(val) => { setReasonFilter(val as string); setPage(1); }}
          options={[
            { value: '', label: 'All Reasons' },
            ...Object.entries(REASON_LABELS).map(([k, v]) => ({ value: k, label: v }))
          ]}
        />
      </div>

      {/* Queue Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><RotateCcw size={36} className="mx-auto mb-3 opacity-30" /><p>No return requests found</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const isExpanded = expandedId === order._id;
            const shortId = order._id.slice(-8).toUpperCase();
            return (
              <div key={order._id} className="border border-silk-light rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 p-4 bg-white cursor-pointer hover:bg-silk-light/30 transition-all"
                  onClick={() => setExpandedId(isExpanded ? null : order._id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-800">#{shortId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.returnStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {order.returnStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{order.shippingDetails?.name} · {order.shippingDetails?.email}</p>
                  </div>
                  <div className="text-sm text-gray-500 hidden sm:block">{REASON_LABELS[order.returnReason] || order.returnReason || '—'}</div>
                  <div className="text-sm text-gray-400 hidden md:block whitespace-nowrap">
                    {order.returnRequestedAt ? new Date(order.returnRequestedAt).toLocaleDateString('en-IN') : '—'}
                  </div>
                  {/* Photo thumbnails */}
                  {order.returnPhotoUrls?.length > 0 && (
                    <div className="flex gap-1">
                      {order.returnPhotoUrls.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt="return" className="w-8 h-8 rounded object-cover border border-gray-200" />
                      ))}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>

                {/* Expanded Action Panel */}
                {isExpanded && (
                  <div className="border-t border-silk-light p-5 bg-silk-light/20 space-y-4">
                    {order.returnConditionNotes && (
                      <div className="text-sm"><span className="font-medium text-gray-700">Condition Notes: </span><span className="text-gray-600">{order.returnConditionNotes}</span></div>
                    )}
                    <div className="text-sm"><span className="font-medium text-gray-700">Items: </span>
                      <span className="text-gray-600">{order.items?.map(i => `${i.product?.name || 'Item'} ×${i.quantity}`).join(', ')}</span>
                    </div>
                    <div className="text-sm"><span className="font-medium text-gray-700">Order Total: </span><span>₹{order.totalAmount?.toLocaleString('en-IN')}</span></div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {order.returnStatus === 'requested' && (
                        <>
                          <button onClick={() => setApproveModal({ open: true, orderId: order._id, refundMethod: 'original_payment' })}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all">
                            <CheckCircle size={15} /> Approve Return
                          </button>
                          <button onClick={() => setRejectModal({ open: true, orderId: order._id, reason: '' })}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all">
                            <XCircle size={15} /> Reject Return
                          </button>
                        </>
                      )}
                      {order.returnStatus === 'approved' && !order.physicalReceived && (
                        <button onClick={() => setConfirmReceiveId(order._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all">
                          <Package size={15} /> Mark as Received
                        </button>
                      )}
                      {order.physicalReceived && (
                        <span className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
                          <Package size={14} /> Item Received
                        </span>
                      )}
                      {order.returnRefundMethod && (
                        <span className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm">
                          Refund: {order.returnRefundMethod.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(total / 15) > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: Math.ceil(total / 15) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-dark-red text-white' : 'bg-silk-light text-dark-red hover:bg-silk'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Analytics Section */}
      {showAnalytics && analytics && (
        <div className="mt-8 border-t border-gray-100 pt-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingDown size={18} className="text-dark-red" /> Return Rate Analytics (30-day)</h3>

          {/* By Category */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-600 mb-3">By Category</h4>
            <div className="space-y-2">
              {analytics.byCategory.map(cat => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-gray-600 capitalize">{cat.category}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-dark-red rounded-full" style={{ width: `${Math.min(cat.returnRate, 100)}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{cat.returnRate}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top SKUs Table */}
          <h4 className="text-sm font-semibold text-gray-600 mb-3">Top 10 Highest Return SKUs</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium">Product</th>
                  <th className="pb-2 pr-4 font-medium text-right">Returns</th>
                  <th className="pb-2 pr-4 font-medium text-right">Units Sold</th>
                  <th className="pb-2 pr-4 font-medium text-right">Return Rate</th>
                  <th className="pb-2 font-medium">Top Reason</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topSkus.map((sku, i) => (
                  <tr key={sku.pid} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <span className="text-xs text-gray-400 mr-2">{i + 1}.</span>
                      <span className="font-medium text-gray-800">{sku.name}</span>
                      <span className="text-xs text-gray-400 ml-1">({sku.pid})</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">{sku.returnCount}</td>
                    <td className="py-2.5 pr-4 text-right">{sku.unitsSold}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={`font-semibold ${sku.returnRate > 20 ? 'text-red-600' : sku.returnRate > 10 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {sku.returnRate}%
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{REASON_LABELS[sku.topReason] || sku.topReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Approve Return</h3>
            <p className="text-sm text-gray-500 mb-5">Select how to refund the customer. A confirmation email will be sent automatically.</p>
            <div className="space-y-2 mb-6">
              {[
                { value: 'original_payment', label: 'Original Payment Method', desc: 'Refund via Razorpay / COD credit' },
                { value: 'store_credit', label: 'Store Credit', desc: 'Add credit to customer account' },
                { value: 'replacement', label: 'Replacement Shipment', desc: 'Create new draft order with same items' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${approveModal.refundMethod === opt.value ? 'border-dark-red bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="refund" value={opt.value} checked={approveModal.refundMethod === opt.value}
                    onChange={() => setApproveModal(m => ({ ...m, refundMethod: opt.value }))} className="mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveModal({ open: false, orderId: '', refundMethod: 'original_payment' })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={handleApprove} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all">
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Reject Return</h3>
            <p className="text-sm text-gray-500 mb-4">A rejection email with the reason below will be sent to the customer.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {REJECTION_PRESETS.map(p => (
                <button key={p} onClick={() => setRejectModal(m => ({ ...m, reason: p }))}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${rejectModal.reason === p ? 'bg-dark-red text-white border-dark-red' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {p}
                </button>
              ))}
            </div>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
              placeholder="Or type a custom rejection reason..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-dark-red/20 mb-4" />
            <div className="flex items-center gap-2 mb-5 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg">
              <AlertTriangle size={13} /> Rejection is irreversible and will fire an email immediately.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal({ open: false, orderId: '', reason: '' })}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={handleReject} disabled={!rejectModal.reason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Received Confirm */}
      {confirmReceiveId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <Package size={36} className="mx-auto mb-3 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Mark Item as Received?</h3>
            <p className="text-sm text-gray-500 mb-5">This will mark the return as completed and may trigger an automatic restock.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReceiveId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={() => handleMarkReceived(confirmReceiveId)} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsManagement;
