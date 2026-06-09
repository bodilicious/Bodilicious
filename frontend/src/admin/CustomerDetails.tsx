import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X, User, ShoppingCart, Star, Headphones, Package,
  TrendingUp, TrendingDown, BarChart2, AlertCircle,
  Loader2, ShoppingBag, MessageSquare, MapPin,
  CheckCircle2, Clock, XCircle, RotateCcw, Save,
  ChevronLeft, ChevronRight, BadgeCheck, Heart,
  Phone, Mail, Calendar, Activity, Shield,
  CreditCard, History, List
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, CartesianGrid
} from 'recharts';
import toast from 'react-hot-toast';
import { mapAuditEvent } from './utils/auditEventMapper';

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
    lifetimeSessions?: number;
    cartHistory?: { timesAdded: number; timesRemoved: number; }[];
    productViewCounts?: { count: number; }[];
  };
  kpi: {
    totalSpend: number; orderCount: number; paidOrders: number;
    cancelledOrders: number; returnedOrders: number; aov: number;
    cancelRate: number; returnRate: number; firstOrderAt?: string; lastOrderAt?: string;
  };
  statusBreakdown: { _id: string; count: number }[];
  ltvTrend: { _id: string; spend: number; orders: number }[];
}

type TabKey = 'overview' | 'orders' | 'payment' | 'reviews' | 'support' | 'cart' | 'activity';

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
  
  const [engagement, setEngagement] = useState<any>(null);
  const [engagementLoading, setEngagementLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchEngagement = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${user._id}/engagement`, { headers });
        const json = await res.json();
        if (json.success && isMounted) {
          setEngagement(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch engagement:", err);
      } finally {
        if (isMounted) setEngagementLoading(false);
      }
    };
    fetchEngagement();
    return () => { isMounted = false; };
  }, [user._id]);

  const pieData = statusBreakdown.map(s => ({ name: s._id, value: s.count }));

  const kpiCards = [
    { label: 'Total Revenue', value: fmtINR(kpi.totalSpend), sub: `${kpi.paidOrders} paid orders`, icon: TrendingUp },
    { label: 'Avg Order Value', value: fmtINR(kpi.aov), sub: 'per paid order', icon: BarChart2 },
    { label: 'Cancel Rate', value: `${kpi.cancelRate}%`, sub: `${kpi.cancelledOrders} cancelled`, icon: TrendingDown },
    { label: 'Return Rate', value: `${kpi.returnRate}%`, sub: `${kpi.returnedOrders} returned`, icon: RotateCcw },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
            <div className="w-10 h-10 rounded-[10px] bg-b-burgundy/10 flex items-center justify-center mb-4">
              <Icon size={18} className="text-b-burgundy" strokeWidth={2} />
            </div>
            <p className="text-3xl font-bold text-b-text-primary mb-1">{value}</p>
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-b-text-primary">{label}</p>
              <p className="text-xs text-b-text-secondary mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Order Status Breakdown + First/Last Order */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie / breakdown */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col h-full">
          <p className="text-sm font-semibold text-b-text-primary mb-6">Order Status Mix</p>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-6 flex-1">
              <PieChart width={120} height={120}>
                <Pie data={pieData} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#6B1E2E' : i === 1 ? '#C9A96E' : i === 2 ? '#DAC1B1' : '#F2EBE4'} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-3">
                {pieData.map((d, i) => {
                  const colors = ['#6B1E2E', '#C9A96E', '#DAC1B1', '#F2EBE4'];
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                        <span className="text-sm text-b-text-secondary capitalize">{d.name.replace('_', ' ')}</span>
                      </div>
                      <span className="text-sm font-bold text-b-text-primary">{d.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-b-text-secondary mt-2">No orders yet.</p>
          )}
        </div>

        {/* Order Dates + Skin Profile */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col h-full">
          <p className="text-sm font-semibold text-b-text-primary mb-6">Timeline</p>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between pl-3 border-l-2 border-b-gold">
              <span className="text-b-text-secondary text-sm">Member Since</span>
              <span className="font-semibold text-b-text-primary text-sm">{fmtDate(user.createdAt)}</span>
            </div>
            <div className="flex justify-between pl-3 border-l-2 border-b-gold">
              <span className="text-b-text-secondary text-sm">First Order</span>
              <span className="font-semibold text-b-text-primary text-sm">{fmtDate(kpi.firstOrderAt)}</span>
            </div>
            <div className="flex justify-between pl-3 border-l-2 border-b-gold">
              <span className="text-b-text-secondary text-sm">Last Order</span>
              <span className="font-semibold text-b-text-primary text-sm">{fmtDate(kpi.lastOrderAt)}</span>
            </div>
            <div className="flex justify-between pl-3 border-l-2 border-b-gold">
              <span className="text-b-text-secondary text-sm">Last Login</span>
              <span className="font-semibold text-b-text-primary text-sm">{fmtDate(user.lastLoginAt)}</span>
            </div>
          </div>
          {user.skinType && (
            <>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-b-text-secondary uppercase tracking-wider mb-3">Skin Profile</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-b-burgundy/5 text-b-burgundy text-[11px] font-bold rounded-full border border-b-burgundy/10">{user.skinType}</span>
                  {(user.skinConcerns || []).map((c: string) => (
                    <span key={c} className="px-3 py-1 bg-gray-50 text-b-text-secondary text-[11px] font-medium rounded-full border border-gray-100">{c}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Engagement & Analytics Grid */}
      <div className="space-y-6 mt-6">
        {engagementLoading ? (
          <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] animate-pulse h-64"></div>
        ) : (
          (() => {
            const totalProductsViewed = (user.productViewCounts || []).reduce((acc: any, item: any) => acc + item.count, 0);
            const totalCartAdds = (user.cartHistory || []).reduce((acc: any, item: any) => acc + item.timesAdded, 0);
            const totalCartRemoves = (user.cartHistory || []).reduce((acc: any, item: any) => acc + item.timesRemoved, 0);
            const lifetimeSessions = user.lifetimeSessions || 0;
            const sessionCount6m = engagement?.sessions6m?.sessionCount || 0;
            const avgSessionLength = engagement?.sessions6m?.averageDurationMs || 0;
            const paymentSuccessRate = engagement?.orders?.successRate || 0;
            const paymentFailures = engagement?.orders?.failedOrders || 0;
            const totalOrders = engagement?.orders?.totalOrders || 0;
            const couponUsageCount = engagement?.orders?.couponUsageCount || 0;

            const isAllZero = totalProductsViewed === 0 && totalCartAdds === 0 && lifetimeSessions === 0 && paymentSuccessRate === 0 && couponUsageCount === 0;

            if (isAllZero) {
              return (
                <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col items-center justify-center py-12">
                  <Activity size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-400">Awaiting Engagement Data</p>
                </div>
              );
            }

            const formatDuration = (ms: number) => {
              if (ms === 0) return "0m";
              const minutes = Math.floor(ms / 60000);
              const seconds = Math.floor((ms % 60000) / 1000);
              if (minutes > 0) return `${minutes}m ${seconds}s`;
              return `${seconds}s`;
            };

            const viewToCartRate = totalProductsViewed > 0 ? ((totalCartAdds / totalProductsViewed) * 100) : 0;
            const cartToOrderRate = totalCartAdds > 0 ? ((totalOrders / totalCartAdds) * 100) : 0;
            const cartAbandonmentRate = totalCartAdds > 0 ? ((totalCartRemoves / totalCartAdds) * 100) : 0;
            const couponDependency = totalOrders > 0 ? ((couponUsageCount / totalOrders) * 100) : 0;

            // Compute Health Score dynamically
            const eScore = Math.min(10, Math.max(1, (lifetimeSessions / 5) + (totalProductsViewed / 50)));
            const pScore = Math.min(10, Math.max(1, viewToCartRate / 10));
            const cScore = Math.min(10, Math.max(1, paymentSuccessRate / 10));
            const lScore = Math.min(10, Math.max(1, kpi.orderCount * 2));
            const vScore = Math.min(10, Math.max(1, kpi.aov / 500));
            const overallHealth = ((eScore + pScore + cScore + lScore + vScore) / 5).toFixed(1);

            const radarData = [
              { subject: 'Engagement', score: eScore },
              { subject: 'Intent', score: pScore },
              { subject: 'Checkout', score: cScore },
              { subject: 'Loyalty', score: lScore },
              { subject: 'Value', score: vScore },
            ];

            const pieDataCheckout = [
              { name: 'Paid', value: kpi.paidOrders || 0, color: '#6B1E2E' }, // Burgundy
              { name: 'Failed', value: paymentFailures || 0, color: '#ef4444' } // Red
            ];

            return (
              <>
                {/* Health Score & Checkout Health Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Health Matrix */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full h-56 -ml-4">
                      <p className="text-sm font-semibold text-b-text-primary mb-2 ml-4">Customer Health Matrix</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                          <PolarGrid stroke="#f1f5f9" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                          <Radar name="Score" dataKey="score" stroke="#C9A96E" fill="#C9A96E" fillOpacity={0.3} />
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 border border-gray-100 rounded-2xl bg-gray-50 shrink-0 min-w-[140px]">
                      <div className="text-4xl font-bold text-b-text-primary mb-1">{overallHealth}</div>
                      <div className="text-[10px] font-bold text-b-text-secondary uppercase tracking-widest mb-3">/ 10 Score</div>
                      <div className={`text-xs px-3 py-1 rounded-full font-medium ${Number(overallHealth) > 7 ? 'bg-green-100 text-green-700' : Number(overallHealth) > 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {Number(overallHealth) > 7 ? 'Loyalist' : Number(overallHealth) > 4 ? 'At Risk' : 'High Churn Risk'}
                      </div>
                    </div>
                  </div>

                  {/* Checkout Health Pie */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-b-text-primary mb-1">Checkout Health</p>
                      <p className="text-xs text-b-text-secondary mb-4">Paid vs Failed attempts</p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-b-burgundy"></div>
                          <span className="text-sm text-b-text-primary font-medium">Paid Orders</span>
                          <span className="text-sm text-gray-400 ml-auto">{kpi.paidOrders}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-sm text-b-text-primary font-medium">Failed Attempts</span>
                          <span className="text-sm text-gray-400 ml-auto">{paymentFailures}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-32 h-32 relative ml-4 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieDataCheckout}
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieDataCheckout.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-lg font-bold text-b-text-primary">{paymentSuccessRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Funnel Metrics Row */}
                <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
                  <h4 className="text-sm font-semibold text-b-text-primary mb-4">Conversion Funnel</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-xs font-medium text-b-text-secondary">Products Viewed</span>
                        <ShoppingBag size={14} className="text-gray-400" />
                      </div>
                      <span className="text-2xl font-bold text-b-text-primary relative z-10">{totalProductsViewed}</span>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-xs font-medium text-b-text-secondary">Cart Additions</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{viewToCartRate.toFixed(1)}%</span>
                      </div>
                      <span className="text-2xl font-bold text-b-text-primary relative z-10">{totalCartAdds}</span>
                      <p className="text-[10px] text-gray-500 mt-1 relative z-10">{totalCartRemoves} removed ({cartAbandonmentRate.toFixed(1)}% drop-off)</p>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <span className="text-xs font-medium text-b-text-secondary">Total Orders</span>
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">{cartToOrderRate.toFixed(1)}%</span>
                      </div>
                      <span className="text-2xl font-bold text-b-text-primary relative z-10">{totalOrders}</span>
                    </div>
                  </div>
                </div>

                {/* Session & Loyalty Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Session Health */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
                    <h4 className="text-sm font-semibold text-b-text-primary mb-4">Session Health</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Activity size={16} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-b-text-primary">Lifetime Sessions</p>
                            <p className="text-[11px] text-gray-500">{sessionCount6m} in the last 6 months</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-b-text-primary">{lifetimeSessions}</span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                            <Clock size={16} className="text-teal-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-b-text-primary">Avg Session Length</p>
                            <p className="text-[11px] text-gray-500">Based on past 6 months</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-b-text-primary">{formatDuration(avgSessionLength)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Checkout & Loyalty */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
                    <h4 className="text-sm font-semibold text-b-text-primary mb-4">Loyalty Insights</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                            <BadgeCheck size={16} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-b-text-primary">Coupon Dependency</p>
                            <p className="text-[11px] text-gray-500">{couponUsageCount} total coupon uses</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-b-text-primary">{couponDependency.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <TrendingUp size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-b-text-primary">Avg Order Value</p>
                            <p className="text-[11px] text-gray-500">Lifetime average</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-b-text-primary">{fmtINR(kpi.aov)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cart Analytics & Revenue Trend Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cart Adds vs Removes */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col h-72">
                    <p className="text-sm font-semibold text-b-text-primary mb-4">Cart Analytics (Adds vs Removes)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Added to Cart', value: totalCartAdds, color: '#3b82f6' },
                        { name: 'Removed from Cart', value: totalCartRemoves, color: '#ef4444' }
                      ]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                          {
                            [
                              { name: 'Added to Cart', value: totalCartAdds, color: '#3b82f6' },
                              { name: 'Removed from Cart', value: totalCartRemoves, color: '#ef4444' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue Trend */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col h-72">
                    <p className="text-sm font-semibold text-b-text-primary mb-4">Total Revenue Generated (Trend)</p>
                    {ltvTrend.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ltvTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#C9A96E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#6B6B6B' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(v: any) => [fmtINR(v), 'Revenue']}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }}
                          />
                          <Area type="monotone" dataKey="spend" stroke="#C9A96E" strokeWidth={3} fill="url(#rev-grad)" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-b-text-secondary">Not enough order data for a trend chart.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()
        )}
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

  const cart = data.cart || [];
  const wishlist = data.wishlist || [];
  const addresses = data.addresses || [];
  const cartValue = data.cartValue || 0;

  return (
    <div className="space-y-6">


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

      {/* Cart History Sub-Component */}
      <CartHistorySection userId={userId} />
    </div>
  );
}

function CartHistorySection({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [aggregated, setAggregated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'aggregated' | 'chronological'>('aggregated');

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/cart-history?limit=10`, { headers });
        if (!res.ok) throw new Error('Failed to load cart history');
        const json = await res.json();
        setLogs(json.data);
        setAggregated(json.aggregatedData || []);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={2} />;

  return (
    <div className="mt-8 border-t border-gray-100 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Recent Cart Activity</p>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('aggregated')}
            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${viewMode === 'aggregated' ? 'bg-white text-[#3D0A05] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Aggregated
          </button>
          <button
            onClick={() => setViewMode('chronological')}
            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${viewMode === 'chronological' ? 'bg-white text-[#3D0A05] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Chronological
          </button>
        </div>
      </div>

      {viewMode === 'aggregated' ? (
        aggregated.length === 0 ? (
          <p className="text-xs text-gray-400">No lifetime cart data available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aggregated.map((item: any) => (
              <div key={item.productId?._id || item._id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-800 line-clamp-1 mb-1">{item.productId?.name || 'Unknown Product'}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex gap-1.5">
                    <span className="text-green-700 font-bold bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">+{item.timesAdded || 0}</span>
                    <span className="text-red-700 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">-{item.timesRemoved || 0}</span>
                  </div>
                  <span className="text-gray-400">Last: {fmtDate(item.lastAddedAt || item.lastRemovedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        logs.length === 0 ? (
          <p className="text-xs text-gray-400">No recent cart events.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Added to Cart Segment */}
            <div>
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Added
              </p>
              {logs.filter(l => l.event_type === 'CART_ITEM_ADDED').length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">No recently added items.</p>
              ) : (
                <div className="space-y-2">
                  {logs.filter(l => l.event_type === 'CART_ITEM_ADDED').map((log: any) => (
                    <div key={log._id} className="flex flex-col gap-0.5 border border-gray-100 rounded-xl p-2.5 hover:bg-gray-50 transition-colors">
                      <p className="text-xs font-medium text-gray-800 truncate">{log.metadata?.productName || 'Product'}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(log.timestamp_utc)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Removed from Cart Segment */}
            <div>
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Removed
              </p>
              {logs.filter(l => l.event_type === 'CART_ITEM_REMOVED').length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">No recently removed items.</p>
              ) : (
                <div className="space-y-2">
                  {logs.filter(l => l.event_type === 'CART_ITEM_REMOVED').map((log: any) => (
                    <div key={log._id} className="flex flex-col gap-0.5 border border-gray-100 rounded-xl p-2.5 hover:bg-gray-50 transition-colors">
                      <p className="text-xs font-medium text-gray-800 truncate">{log.metadata?.productName || 'Product'}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(log.timestamp_utc)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Tab: Payment History ─────────────────────────────────────────────────────

function PaymentHistoryTab({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/payment-history`, { headers });
        if (!res.ok) throw new Error('Failed to load payment history');
        const json = await res.json();
        setData(json.data);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={3} />;
  if (!data) return <EmptyState icon={CreditCard} title="No Data" body="Could not load payment history." />;

  const { orders, failedAttempts } = data;

  return (
    <div className="space-y-6">
      {failedAttempts?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-1.5"><AlertCircle size={14} /> Failed Payment Attempts</p>
          <div className="space-y-2">
            {failedAttempts.map((fail: any) => (
              <div key={fail._id} className="bg-white rounded-xl p-3 border border-red-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-900">{fail.metadata?.reason || 'Payment Failed'}</p>
                  <p className="text-[10px] text-red-500 mt-0.5">{fmtDate(fail.timestamp_utc)}</p>
                </div>
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full uppercase">Failed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Order Payment History</p>
        {orders?.length === 0 ? (
          <p className="text-xs text-gray-400">No order payment history.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o._id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-800">Order #{o.orderId || o._id.slice(-8).toUpperCase()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(o.createdAt)} · {o.paymentMethod || 'Unknown method'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#3D0A05]">{fmtINR(o.totalAmount || 0)}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    o.paymentStatus === 'paid' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {o.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Activity & Audit ────────────────────────────────────────────────────

function ActivityAuditTab({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/activity?limit=10`, { headers });
        if (!res.ok) throw new Error('Failed to load activity');
        const json = await res.json();
        setSessions(json.data);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <TabSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Recent Sessions</p>
        {sessions.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100 border-dashed">
            <Activity className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">Session tracking started on Jun 8, 2026</p>
            <p className="text-[10px] text-gray-400 mt-1">No earlier data available.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess: any) => {
              const durMinutes = Math.round((sess.durationMs || 0) / 60000);
              const hours = Math.floor(durMinutes / 60);
              const mins = durMinutes % 60;
              const durStr = hours > 0 ? `${hours}h ${mins} mins` : durMinutes > 0 ? `${mins} mins` : '< 1 min';
              
              return (
                <div key={sess._id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Logged in on {fmtDate(sess.startTime)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Spent {durStr} on the website
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RawAuditLogSection userId={userId} />
    </div>
  );
}

function RawAuditLogSection({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventType, setEventType] = useState('');

  const fetchLogs = useCallback(async (pageNum: number, applyFilters = false) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      let url = `${API_BASE}/admin/customers/${userId}/audit?page=${pageNum}&limit=20`;
      
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (eventType) url += `&eventType=${eventType}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const json = await res.json();
      setLogs(prev => (pageNum === 1 || applyFilters) ? json.data : [...prev, ...json.data]);
      setHasMore(json.pagination.page < json.pagination.pages);
      if (applyFilters) setPage(1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, eventType]);

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Intentionally not including filters to avoid auto-fetch on every keystroke

  const handleApplyFilters = () => {
    fetchLogs(1, true);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setEventType('');
    // Need to trigger a fetch after state update, so we'll do it via useEffect or just directly:
    // But since state updates are async, it's safer to build the URL without them
    (async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/admin/customers/${userId}/audit?page=1&limit=20`, { headers });
        if (!res.ok) throw new Error('Failed to load audit logs');
        const json = await res.json();
        setLogs(json.data);
        setHasMore(json.pagination.page < json.pagination.pages);
        setPage(1);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const eventTypes = [
    "CART_ITEM_ADDED", "CART_ITEM_REMOVED", "PRODUCT_VIEWED", "LOGIN",
    "LOGIN_FAILED", "LOGOUT", "ORDER_PLACED", "ORDER_CANCELLED",
    "ORDER_STATUS_CHANGED", "PAYMENT_FAILED", "TICKET_CREATED",
    "PROFILE_UPDATED", "USER_BLOCKED", "USER_UNBLOCKED"
  ];

  return (
    <div className="border-t border-gray-100 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <List size={14} /> Raw Audit Log
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[24px] px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)] border border-gray-100 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs border-gray-200 rounded-full px-4 py-2 focus:ring-[#3D0A05] focus:border-[#3D0A05]" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border-gray-200 rounded-full px-4 py-2 focus:ring-[#3D0A05] focus:border-[#3D0A05]" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Event Type</label>
          <select value={eventType} onChange={e => setEventType(e.target.value)} className="text-xs border-gray-200 rounded-full px-4 py-2 focus:ring-[#3D0A05] focus:border-[#3D0A05]">
            <option value="">All Events</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleApplyFilters} className="bg-b-burgundy text-white text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full hover:bg-ruby-red transition-colors">Apply</button>
          <button onClick={handleClearFilters} className="bg-white text-b-text-secondary border border-gray-200 text-xs font-semibold uppercase tracking-wider px-5 py-2 rounded-full hover:bg-gray-50 transition-colors">Clear</button>
        </div>
      </div>
      
      <div className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400">No logs found for these filters.</p>
        ) : (
          logs.map((log: any) => (
            <div key={log._id} className="border border-gray-100 rounded-lg p-2.5 flex items-center gap-3 bg-white">
              <span className="text-[10px] font-mono text-gray-400 w-24 flex-shrink-0">{fmtDate(log.timestamp_utc)}</span>
              <span className="text-[10px] font-medium text-[#3D0A05] flex-1">{mapAuditEvent(log)}</span>
            </div>
          ))
        )}
      </div>
      
      {hasMore && logs.length > 0 && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => {
              setPage(p => p + 1);
              fetchLogs(page + 1);
            }} 
            disabled={loading}
            className="text-xs font-bold text-[#3D0A05] hover:underline disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Logs'}
          </button>
        </div>
      )}
    </div>
  );
}


// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview',  label: 'Overview',  icon: BarChart2 },
  { key: 'orders',    label: 'Orders',    icon: ShoppingCart },
  { key: 'payment',   label: 'Payments',  icon: CreditCard },
  { key: 'reviews',   label: 'Reviews',   icon: Star },
  { key: 'support',   label: 'Support',   icon: Headphones },
  { key: 'cart',      label: 'Cart',      icon: Package },
  { key: 'activity',  label: 'Activity',  icon: Activity },
];

export default function CustomerDetails() {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
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

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };

  if (!userId) return <div className="p-8">No Customer ID provided.</div>;

  const user = summary?.user;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-b-bg text-b-text-primary">
      {/* ── Header ── */}
      <div className="bg-b-burgundy/5 backdrop-blur-md px-6 py-5 flex-shrink-0 border-b border-b-burgundy/10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full border-2 border-b-gold bg-white flex items-center justify-center text-b-burgundy font-bold text-xl flex-shrink-0 shadow-sm">
              {user?.name?.[0]?.toUpperCase() || <User size={22} />}
            </div>
            <div>
              {summaryLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 w-40 bg-gray-200 rounded-lg" />
                  <div className="h-3 w-56 bg-gray-100 rounded-lg" />
                </div>
              ) : user ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-b-text-primary font-bold text-xl leading-tight">{user.name}</h2>
                    {user.isBlocked && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full shadow-sm">Blocked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1.5 text-b-text-secondary text-xs"><Mail size={12} />{user.email}</span>
                    {user.phone && <span className="flex items-center gap-1.5 text-b-text-secondary text-xs"><Phone size={12} />{user.phone}</span>}
                  </div>
                  {(user.segment || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {(user.segment || []).map((seg: string) => (
                        <span key={seg} className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm ${seg === 'new' ? 'bg-b-gold/10 text-b-gold border border-b-gold/30' : 'bg-white text-b-text-secondary border border-gray-100'}`}>
                          {seg.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : summaryError ? (
                <p className="text-red-500 text-sm">{summaryError}</p>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-b-burgundy/10 bg-white hover:bg-b-bg text-b-text-secondary hover:text-b-text-primary transition-colors flex-shrink-0 text-xs font-semibold shadow-sm"
          >
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      </div>

          {/* ── Tab Bar ── */}
          <div className="px-6 py-4 flex-shrink-0 overflow-x-auto">
            <div className="bg-white rounded-full p-1.5 inline-flex items-center shadow-[0_1px_4px_rgba(0,0,0,0.07)] border border-gray-100">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
                  id={`customer-tab-${key}`}
                  className={`flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-wider transition-all rounded-full whitespace-nowrap ${
                    activeTab === key
                      ? 'bg-b-burgundy/5 text-b-burgundy font-bold'
                      : 'text-b-text-secondary hover:text-b-text-primary hover:bg-gray-50 font-medium'
                  }`}
                >
                  <Icon size={16} strokeWidth={activeTab === key ? 2.5 : 2} />
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
            ) : activeTab === 'payment' && visitedTabs.has('payment') ? (
              <PaymentHistoryTab userId={userId} />
            ) : activeTab === 'activity' && visitedTabs.has('activity') ? (
              <ActivityAuditTab userId={userId} />
            ) : (
              // Placeholder for unvisited tabs (transitioning)
              <TabSkeleton rows={5} />
            )}
          </div>
      </div>
  );
}
