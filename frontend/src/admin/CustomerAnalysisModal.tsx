import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, User, ShoppingCart, Star, Headphones, Package,
  TrendingUp, TrendingDown, BarChart2, AlertCircle,
  Loader2, ShoppingBag, MessageSquare, MapPin,
  CheckCircle2, Clock, XCircle, RotateCcw, Save,
  ChevronLeft, ChevronRight, BadgeCheck, Heart,
  Phone, Mail, Calendar, Activity, Shield
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import toast from 'react-hot-toast';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerSummary {
  user: {
    _id: string; name: string; email: string; phone?: string; avatar?: string;
    segment?: string[]; lifetimeSpend?: number; adminNotes?: string;
    createdAt: string; lastLoginAt?: string; isBlocked?: boolean; role?: string;
    skinType?: string; skinConcerns?: string[]; preferredRoutine?: string;
    gender?: string; dateOfBirth?: string;
  };
  kpi: {
    totalSpend: number; orderCount: number; paidOrders: number;
    cancelledOrders: number; returnedOrders: number; aov: number;
    cancelRate: number; returnRate: number; firstOrderAt?: string; lastOrderAt?: string;
  };
  statusBreakdown: { _id: string; count: number }[];
  ltvTrend: { _id: string; spend: number; orders: number }[];
}

type TabKey = 'overview' | 'orders' | 'reviews' | 'support' | 'cart';

interface Props {
  userId: string | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SEGMENT_STYLES: Record<string, string> = {
  high_value: 'bg-amber-100 text-amber-700',
  loyal: 'bg-teal-100 text-teal-700',
  at_risk: 'bg-red-100 text-red-600',
  new: 'bg-blue-100 text-blue-700',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  pending:          { bg: 'bg-yellow-50',  text: 'text-yellow-700', icon: Clock },
  processing:       { bg: 'bg-blue-50',    text: 'text-blue-700',   icon: Activity },
  shipped:          { bg: 'bg-indigo-50',  text: 'text-indigo-700', icon: Package },
  delivered:        { bg: 'bg-green-50',   text: 'text-green-700',  icon: CheckCircle2 },
  cancelled:        { bg: 'bg-red-50',     text: 'text-red-600',    icon: XCircle },
  return_requested: { bg: 'bg-orange-50',  text: 'text-orange-700', icon: RotateCcw },
  returned:         { bg: 'bg-gray-50',    text: 'text-gray-600',   icon: RotateCcw },
};

const PIE_COLORS = ['#3D0A05', '#7C1A13', '#B85C4A', '#D4928A', '#ECC9C4', '#94a3b8'];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={13}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

function TabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-700 text-sm">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{body}</p>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ summary }: { summary: CustomerSummary }) {
  const { kpi, statusBreakdown, ltvTrend, user } = summary;

  const pieData = statusBreakdown.map(s => ({ name: s._id, value: s.count }));

  const kpiCards = [
    { label: 'Lifetime Spend', value: fmtINR(kpi.totalSpend), sub: `${kpi.paidOrders} paid orders`, icon: TrendingUp, highlight: true },
    { label: 'Avg Order Value', value: fmtINR(kpi.aov), sub: 'per paid order', icon: BarChart2, highlight: false },
    { label: 'Cancel Rate', value: `${kpi.cancelRate}%`, sub: `${kpi.cancelledOrders} cancelled`, icon: TrendingDown, highlight: false },
    { label: 'Return Rate', value: `${kpi.returnRate}%`, sub: `${kpi.returnedOrders} returned`, icon: RotateCcw, highlight: false },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(({ label, value, sub, icon: Icon, highlight }) => (
          <div key={label} className={`rounded-2xl p-4 border ${highlight ? 'bg-[#3D0A05] border-[#3D0A05] text-white' : 'bg-gray-50 border-gray-100'}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${highlight ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
              <Icon size={15} className={highlight ? 'text-white' : 'text-[#3D0A05]'} />
            </div>
            <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${highlight ? 'text-white/60' : 'text-gray-400'}`}>{label}</p>
            <p className={`text-xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            <p className={`text-[10px] mt-0.5 ${highlight ? 'text-white/50' : 'text-gray-400'}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* LTV Trend Chart */}
      {ltvTrend.length > 1 ? (
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-4">Spend Trend — Last 12 Months</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ltvTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ltv-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3D0A05" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3D0A05" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => [fmtINR(v), 'Spend']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="spend" stroke="#3D0A05" strokeWidth={2} fill="url(#ltv-grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-center">
          <p className="text-xs text-gray-400">Not enough order data for a trend chart yet.</p>
        </div>
      )}

      {/* Order Status Breakdown + First/Last Order */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie / breakdown */}
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Order Status Mix</p>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <PieChart width={100} height={100}>
                <Pie data={pieData} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value" strokeWidth={1}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-gray-600 capitalize">{d.name.replace('_', ' ')}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">No orders yet.</p>
          )}
        </div>

        {/* Order Dates + Skin Profile */}
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Timeline</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Member Since</span>
              <span className="font-medium text-gray-800 text-xs">{fmtDate(user.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">First Order</span>
              <span className="font-medium text-gray-800 text-xs">{fmtDate(kpi.firstOrderAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Last Order</span>
              <span className="font-medium text-gray-800 text-xs">{fmtDate(kpi.lastOrderAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Last Login</span>
              <span className="font-medium text-gray-800 text-xs">{fmtDate(user.lastLoginAt)}</span>
            </div>
          </div>
          {user.skinType && (
            <>
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Skin Profile</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-medium rounded-full">{user.skinType}</span>
                  {(user.skinConcerns || []).map(c => (
                    <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Orders ──────────────────────────────────────────────────────────────

function OrdersTab({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fetched = useRef(false);

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/customers/${userId}/orders?page=${page}&limit=10`, { headers });
      if (!res.ok) throw new Error('Failed to load orders');
      const json = await res.json();
      setOrders(json.data);
      setPagination(json.pagination);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!fetched.current) { fetched.current = true; fetchOrders(1); }
  }, [fetchOrders]);

  if (loading) return <TabSkeleton rows={6} />;

  if (orders.length === 0) {
    return <EmptyState icon={ShoppingBag} title="No orders yet" body="This customer hasn't placed any orders. Their full purchase history will appear here." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{pagination.total} total orders · page {pagination.page} of {pagination.pages}</p>

      {orders.map((order: any) => {
        const style = STATUS_STYLES[order.orderStatus] || STATUS_STYLES.pending;
        const StatusIcon = style.icon;
        const isExpanded = expandedId === order._id;

        return (
          <div key={order._id} className="border border-gray-100 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : order._id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                  <StatusIcon size={15} className={style.text} />
                </div>
                <div>
                  <p className="text-xs font-mono text-gray-400">#{order._id.slice(-8).toUpperCase()}</p>
                  <p className="text-sm font-semibold text-gray-800">{fmtINR(order.totalAmount || 0)}</p>
                  <p className="text-[10px] text-gray-400">{fmtDate(order.createdAt)} · {(order.items || []).length} item{order.items?.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize ${style.bg} ${style.text}`}>
                  {order.orderStatus?.replace('_', ' ')}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {order.paymentStatus}
                </span>
                <ChevronRight size={14} className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-2">
                {(order.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    {item.product?.images?.[0] ? (
                      <img src={item.product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Package size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.product?.name || 'Product'}</p>
                      <p className="text-[10px] text-gray-400">Qty: {item.quantity} · {fmtINR(item.price || 0)}</p>
                    </div>
                  </div>
                ))}
                {order.shippingDetails?.city && (
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                    Shipped to: {order.shippingDetails.city}, {order.shippingDetails.state}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => fetchOrders(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="flex items-center gap-1 text-xs text-[#3D0A05] disabled:opacity-30 hover:underline"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs text-gray-400">Page {pagination.page} of {pagination.pages}</span>
          <button
            onClick={() => fetchOrders(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="flex items-center gap-1 text-xs text-[#3D0A05] disabled:opacity-30 hover:underline"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Reviews ─────────────────────────────────────────────────────────────

function ReviewsTab({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/reviews`, { headers });
        if (!res.ok) throw new Error('Failed to load reviews');
        const json = await res.json();
        setReviews(json.data);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={4} />;

  if (reviews.length === 0) {
    return <EmptyState icon={Star} title="No reviews yet" body="This customer hasn't reviewed any products. Reviews and ratings will appear here once submitted." />;
  }

  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">{avgRating.toFixed(1)}</p>
          <StarRating rating={Math.round(avgRating)} />
          <p className="text-[10px] text-amber-600 mt-0.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map(star => {
            const count = reviews.filter(r => r.rating === star).length;
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[10px] text-amber-600 w-4">{star}</span>
                <div className="flex-1 bg-amber-100 rounded-full h-1.5">
                  <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 w-3">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {reviews.map((review: any) => (
        <div key={review._id} className="border border-gray-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            {review.productImage ? (
              <img src={review.productImage} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{review.productName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StarRating rating={review.rating} />
                {review.isVerified && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-medium">
                    <BadgeCheck size={11} /> Verified
                  </span>
                )}
              </div>
              {review.comment && (
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{review.comment}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">{fmtDate(review.createdAt)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Support ─────────────────────────────────────────────────────────────

function SupportTab({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/tickets`, { headers });
        if (!res.ok) throw new Error('Failed to load tickets');
        const json = await res.json();
        setTickets(json.data);
        setStats(json.stats);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={4} />;

  if (tickets.length === 0) {
    return <EmptyState icon={Headphones} title="No support tickets" body="This customer hasn't raised any support tickets. Any shipping, payment, or other requests will appear here." />;
  }

  const ticketStatusStyle: Record<string, string> = {
    open: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    resolved: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  const ticketTypeStyle: Record<string, string> = {
    shipping: 'bg-blue-50 text-blue-700',
    payment: 'bg-purple-50 text-purple-700',
    other: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-800' },
          { label: 'Open', value: stats.open, color: 'text-yellow-600' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-600' },
          { label: 'Avg Resolution', value: stats.avgResolutionDays != null ? `${stats.avgResolutionDays}d` : '—', color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {tickets.map((ticket: any) => (
        <div key={ticket._id} className="border border-gray-100 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[10px] font-mono text-gray-400">{ticket.ticketId}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${ticketTypeStyle[ticket.type] || ticketTypeStyle.other}`}>
                  {ticket.type}
                </span>
                {ticket.priority === 'high' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-600">
                    High Priority
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-700 line-clamp-2">{ticket.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(ticket.createdAt)}</span>
                <span className="flex items-center gap-1"><MessageSquare size={10} />{ticket.messageCount} message{ticket.messageCount !== 1 ? 's' : ''}</span>
                {ticket.resolvedAt && (
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={10} />Resolved {fmtDate(ticket.resolvedAt)}</span>
                )}
              </div>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border capitalize flex-shrink-0 ${ticketStatusStyle[ticket.status] || ''}`}>
              {ticket.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Profile & Cart ──────────────────────────────────────────────────────

function CartTab({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/cart`, { headers });
        if (!res.ok) throw new Error('Failed to load cart');
        const json = await res.json();
        setData(json.data);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={5} />;
  if (!data) return <EmptyState icon={Package} title="No data" body="Could not load cart and profile data." />;

  const { cart, wishlist, skinProfile, addresses, cartValue } = data;

  return (
    <div className="space-y-6">
      {/* Skin Profile */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Skin Profile</p>
        {skinProfile.skinType || skinProfile.skinConcerns.length > 0 || skinProfile.preferredRoutine ? (
          <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {skinProfile.skinType && (
              <div>
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider">Skin Type</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{skinProfile.skinType}</p>
              </div>
            )}
            {skinProfile.preferredRoutine && (
              <div>
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider">Routine</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{skinProfile.preferredRoutine}</p>
              </div>
            )}
            {skinProfile.gender && (
              <div>
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider">Gender</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{skinProfile.gender}</p>
              </div>
            )}
            {skinProfile.skinConcerns.length > 0 && (
              <div className="col-span-full">
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider mb-1.5">Skin Concerns</p>
                <div className="flex flex-wrap gap-1.5">
                  {skinProfile.skinConcerns.map((c: string) => (
                    <span key={c} className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-[11px] rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={User} title="No skin profile" body="This customer hasn't completed their skin profile in the ritual finder." />
        )}
      </div>

      {/* Current Cart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Current Cart</p>
          {cart.length > 0 && (
            <span className="text-xs font-bold text-[#3D0A05]">{fmtINR(cartValue)} total</span>
          )}
        </div>
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Empty cart" body="No items currently in this customer's cart." />
        ) : (
          <div className="space-y-2">
            {cart.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                {item.product?.images?.[0] ? (
                  <img src={item.product.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.product?.name || 'Product'}</p>
                  <p className="text-[10px] text-gray-400">{fmtINR(item.product?.price || 0)} · Qty {item.quantity}</p>
                </div>
                <p className="text-xs font-bold text-gray-800 flex-shrink-0">
                  {fmtINR((item.product?.price || 0) * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wishlist */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Wishlist ({wishlist.length})</p>
        {wishlist.length === 0 ? (
          <EmptyState icon={Heart} title="Empty wishlist" body="No products saved to wishlist." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {wishlist.map((product: any) => (
              <div key={product._id} className="border border-gray-100 rounded-xl p-2.5 flex items-center gap-2">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-800 truncate">{product.name}</p>
                  <p className="text-[10px] text-gray-400">{fmtINR(product.price || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved Addresses */}
      {addresses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Saved Addresses</p>
          <div className="space-y-2">
            {addresses.map((addr: any, idx: number) => (
              <div key={idx} className={`border rounded-xl p-3 flex items-start gap-2.5 ${addr.isDefault ? 'border-[#3D0A05]/20 bg-[#3D0A05]/5' : 'border-gray-100'}`}>
                <MapPin size={14} className={addr.isDefault ? 'text-[#3D0A05] mt-0.5' : 'text-gray-300 mt-0.5'} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-gray-800">{addr.name}</p>
                    {addr.isDefault && <span className="text-[9px] font-bold text-[#3D0A05] uppercase tracking-wider">Default</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {[addr.houseNumber, addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-[10px] text-gray-400">{addr.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Notes Panel ────────────────────────────────────────────────────────

function AdminNotesPanel({ userId, initialNotes }: { userId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/customers/${userId}/notes`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ adminNotes: notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Save failed');
      }
      toast.success('Notes saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save notes — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Shield size={10} /> Admin Notes <span className="text-gray-300 font-normal">(private)</span>
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#3D0A05] hover:underline disabled:opacity-40 transition-opacity"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Add private notes about this customer (not visible to them)…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-[#3D0A05]/20 bg-white"
      />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview',  label: 'Overview',  icon: BarChart2 },
  { key: 'orders',    label: 'Orders',    icon: ShoppingCart },
  { key: 'reviews',   label: 'Reviews',   icon: Star },
  { key: 'support',   label: 'Support',   icon: Headphones },
  { key: 'cart',      label: 'Profile & Cart', icon: Package },
];

export default function CustomerAnalysisModal({ userId, onClose }: Props) {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(new Set(['overview']));

  const fetchSummary = useCallback(async () => {
    if (!userId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/customers/${userId}/summary`, { headers });
      if (!res.ok) throw new Error('Failed to load customer profile');
      const json = await res.json();
      setSummary(json.data);
    } catch (e: any) {
      setSummaryError(e.message);
    } finally {
      setSummaryLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setSummary(null);
      setActiveTab('overview');
      setVisitedTabs(new Set(['overview']));
      fetchSummary();
    }
  }, [userId, fetchSummary]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };

  if (!userId) return null;

  const user = summary?.user;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col pointer-events-auto overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="bg-[#3D0A05] px-6 py-5 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() || <User size={22} />}
                </div>
                <div>
                  {summaryLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-5 w-40 bg-white/20 rounded-lg" />
                      <div className="h-3 w-56 bg-white/10 rounded-lg" />
                    </div>
                  ) : user ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-white font-bold text-lg leading-tight">{user.name}</h2>
                        {user.isBlocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-red-500/80 text-white px-2 py-0.5 rounded-full">Blocked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-white/60 text-xs"><Mail size={10} />{user.email}</span>
                        {user.phone && <span className="flex items-center gap-1 text-white/60 text-xs"><Phone size={10} />{user.phone}</span>}
                      </div>
                      {(user.segment || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(user.segment || []).map(seg => (
                            <span key={seg} className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold capitalize ${SEGMENT_STYLES[seg] || 'bg-gray-100 text-gray-600'}`}>
                              {seg.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : summaryError ? (
                    <p className="text-red-300 text-sm">{summaryError}</p>
                  ) : null}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors flex-shrink-0"
                id="close-customer-modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick KPI strip (visible once loaded) */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/10">
                {[
                  { label: 'Lifetime Spend', value: fmtINR(summary.kpi.totalSpend) },
                  { label: 'Total Orders', value: summary.kpi.orderCount },
                  { label: 'AOV', value: fmtINR(summary.kpi.aov) },
                  { label: 'Cancel Rate', value: `${summary.kpi.cancelRate}%` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-white/40 text-[9px] uppercase tracking-wider">{label}</p>
                    <p className="text-white font-bold text-base leading-tight">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Tab Bar ── */}
          <div className="border-b border-gray-100 bg-white flex-shrink-0 overflow-x-auto">
            <div className="flex min-w-max">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
                  id={`customer-tab-${key}`}
                  className={`flex items-center gap-1.5 px-5 py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'border-[#3D0A05] text-[#3D0A05]'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {summaryError && !summaryLoading && activeTab === 'overview' ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <AlertCircle size={28} className="mb-2 text-red-400" />
                <p className="text-sm text-red-600">{summaryError}</p>
                <button onClick={fetchSummary} className="mt-3 text-xs text-[#3D0A05] hover:underline">
                  Retry
                </button>
              </div>
            ) : activeTab === 'overview' ? (
              summaryLoading || !summary ? (
                <div className="space-y-4 animate-pulse">
                  <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}</div>
                  <div className="h-48 bg-gray-100 rounded-2xl" />
                  <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}</div>
                </div>
              ) : (
                <OverviewTab summary={summary} />
              )
            ) : activeTab === 'orders' && visitedTabs.has('orders') ? (
              <OrdersTab userId={userId} />
            ) : activeTab === 'reviews' && visitedTabs.has('reviews') ? (
              <ReviewsTab userId={userId} />
            ) : activeTab === 'support' && visitedTabs.has('support') ? (
              <SupportTab userId={userId} />
            ) : activeTab === 'cart' && visitedTabs.has('cart') ? (
              <CartTab userId={userId} />
            ) : (
              // Placeholder for unvisited tabs (transitioning)
              <TabSkeleton rows={5} />
            )}
          </div>

          {/* ── Admin Notes (always visible) ── */}
          {userId && summary && (
            <AdminNotesPanel userId={userId} initialNotes={summary.user.adminNotes || ''} />
          )}
        </div>
      </div>
    </>
  );
}
