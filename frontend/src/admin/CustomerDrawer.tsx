import { X, TrendingUp, ShoppingBag, Calendar, Clock, AlertCircle, Loader2, Save } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { auth } = await import('../firebase');
  const { getIdToken } = await import('firebase/auth');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await getIdToken(auth.currentUser)}`;
  }
  return headers;
}

interface CustomerSummary {
  totalSpend: number;
  orderCount: number;
  firstOrderAt: string;
  lastOrderAt: string;
  avgDaysBetweenOrders: number;
}

interface CustomerData {
  customer: { id: string; name: string; email: string; segment?: string[]; lifetimeSpend?: number; adminNotes?: string };
  summary: CustomerSummary;
  orders: any[];
  frequencySeries: { _id: string; count: number }[];
  pagination: { page: number; pages: number; total: number };
}

interface Props {
  userId: string | null;
  onClose: () => void;
}

export default function CustomerDrawer({ userId, onClose }: Props) {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [adminNotes, setAdminNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const fetchHistory = useCallback(async (p = 1) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/customers/${userId}/profile?page=${p}&limit=8`, { headers });
      if (!res.ok) throw new Error('Failed to load customer profile');
      const json = await res.json();
      const profileData = json.data;
      // Map to the shape CustomerData expects
      setData({
        customer: {
          id: profileData.user._id,
          name: profileData.user.name,
          email: profileData.user.email,
          segment: profileData.user.segment,
          lifetimeSpend: profileData.user.lifetimeSpend,
          adminNotes: profileData.user.adminNotes,
        },
        summary: {
          totalSpend: profileData.stats?.totalSpend || 0,
          orderCount: profileData.stats?.orderCount || 0,
          firstOrderAt: profileData.stats?.firstOrderAt,
          lastOrderAt: profileData.stats?.lastOrderAt,
          avgDaysBetweenOrders: 0,
        },
        orders: profileData.orders,
        frequencySeries: [],
        pagination: profileData.pagination,
      });
      setAdminNotes(profileData.user.adminNotes || '');
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleSaveNotes = async () => {
    if (!userId) return;
    setNotesSaving(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/admin/customers/${userId}/notes`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ adminNotes }),
      });
    } finally {
      setNotesSaving(false);
    }
  };

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  if (!userId) return null;

  const chartData = (data?.frequencySeries || []).map(s => ({ month: s._id, orders: s.count }));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Customer Profile</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Loading customer history…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <AlertCircle size={32} className="mb-3 text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={() => fetchHistory(1)} className="mt-3 text-xs text-blue-600 hover:underline">Retry</button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Customer Info */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-dark-red/10 flex items-center justify-center text-dark-red font-bold text-lg">
                    {data.customer.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{data.customer.name}</p>
                    <p className="text-xs text-gray-500 truncate">{data.customer.email}</p>
                  </div>
                </div>
                {/* Segment Tags */}
                {data.customer.segment && data.customer.segment.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {data.customer.segment.map(seg => (
                      <span key={seg} className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        seg === 'high_value' ? 'bg-amber-100 text-amber-700' :
                        seg === 'loyal' ? 'bg-teal-100 text-teal-700' :
                        seg === 'at_risk' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>{seg.replace('_', ' ')}</span>
                    ))}
                  </div>
                )}
                {/* Lifetime Spend */}
                {data.customer.lifetimeSpend !== undefined && (
                  <p className="text-xs text-gray-500">Lifetime spend: <span className="font-semibold text-gray-800">₹{data.customer.lifetimeSpend.toLocaleString('en-IN')}</span></p>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 px-6 py-5 border-b border-gray-100">
                {[
                  { label: 'Total Spend', value: `₹${(data.summary.totalSpend || 0).toFixed(0)}`, icon: TrendingUp },
                  { label: 'Total Orders', value: data.summary.orderCount, icon: ShoppingBag },
                  { label: 'First Order', value: data.summary.firstOrderAt ? new Date(data.summary.firstOrderAt).toLocaleDateString('en-IN') : '—', icon: Calendar },
                  { label: 'Avg Days Between', value: data.summary.avgDaysBetweenOrders ? `${data.summary.avgDaysBetweenOrders}d` : '—', icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Icon size={16} className="text-dark-red" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-bold text-gray-800">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin Notes */}
              <div className="px-6 py-5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Admin Notes</p>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add private notes about this customer..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-dark-red/20"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="mt-2 flex items-center gap-1.5 text-xs text-dark-red hover:underline disabled:opacity-40"
                >
                  <Save size={12} /> {notesSaving ? 'Saving…' : 'Save Notes'}
                </button>
              </div>

              {/* Frequency Chart */}
              {chartData.length > 1 && (
                <div className="px-6 py-5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Order Frequency</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [`${v} orders`]} />
                      <Line type="monotone" dataKey="orders" stroke="#3D0A05" strokeWidth={2} dot={{ r: 3, fill: '#3D0A05' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Order List */}
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">
                  Orders ({data.pagination.total})
                </p>

                {data.orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShoppingBag size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No orders found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.orders.map((order: any) => (
                      <div key={order._id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono text-gray-500">#{order._id.slice(-8).toUpperCase()}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">₹{order.totalAmount?.toFixed(0)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium capitalize ${
                          order.orderStatus === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {order.orderStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {data.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => fetchHistory(page - 1)}
                      disabled={page <= 1}
                      className="text-xs text-dark-red disabled:opacity-30 hover:underline"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-gray-400">Page {page} of {data.pagination.pages}</span>
                    <button
                      onClick={() => fetchHistory(page + 1)}
                      disabled={page >= data.pagination.pages}
                      className="text-xs text-dark-red disabled:opacity-30 hover:underline"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
