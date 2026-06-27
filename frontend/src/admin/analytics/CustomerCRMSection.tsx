import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Line, ComposedChart, AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, Zap, Clock, CalendarDays, AlertCircle } from 'lucide-react';

interface CustomerCRMSectionProps {
  segmentStats: any[];
  funnelData: any[];
  trendData?: any[]; // New vs Returning buyer trend
  support?: {
    ticketTrends: Array<{ date: string; dayOfWeek: number; count: number }>;
    topIssues: Array<{ type: string; count: number }>;
    resolutionTimes: {
      overall: { frt: number[]; ttr: number[] };
      byType: Record<string, { frt: number[]; ttr: number[] }>;
    };
  };
  loading?: boolean;
}

const SEGMENT_META: Record<string, { color: string; label: string }> = {
  new:        { color: '#BE185D', label: 'New' },
  loyal:      { color: '#3D0A05', label: 'Loyal' },
  at_risk:    { color: '#D97706', label: 'At Risk' },
  high_value: { color: '#065F46', label: 'High Value' },
};

const FUNNEL_COLORS = ['#3D0A05', '#7C3AED', '#BE185D', '#0891B2'];

const BuyerTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 rounded-2xl p-4 shadow-xl border border-black/5 font-sans">
      <p className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-[13px] font-semibold text-gray-900">{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const StatBadge: React.FC<{ label: string; value: string | number; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all cursor-default">
    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</div>
    <div className="text-3xl font-black leading-tight" style={{ color, fontFamily: 'Playfair Display, serif' }}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const CustomerCRMSection: React.FC<CustomerCRMSectionProps> = ({
  segmentStats,
  funnelData,
  trendData = [],
  support
}) => {
  const totalCustomers = segmentStats.reduce((s, x) => s + x.customerCount, 0);
  const totalRevenue = segmentStats.reduce((s, x) => s + x.revenue, 0);
  const loyalCount = segmentStats.find(s => s.segment === 'loyal')?.customerCount || 0;
  const loyalPct = totalCustomers > 0 ? ((loyalCount / totalCustomers) * 100).toFixed(0) : 0;

  const funnelOrder = ['New', '2nd Purchase', '3rd Purchase', 'Loyal (4+)'];
  const sortedFunnel = [...funnelData].sort((a, b) => funnelOrder.indexOf(a._id) - funnelOrder.indexOf(b._id));

  // Process Support Data
  const getAvg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  
  const resolutionData = support?.resolutionTimes ? Object.keys(support.resolutionTimes.byType).map(type => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    avgFrt: getAvg(support.resolutionTimes.byType[type].frt),
    avgTtr: getAvg(support.resolutionTimes.byType[type].ttr)
  })) : [];

  let paretoData: any[] = [];
  if (support?.topIssues) {
    const totalIssues = support.topIssues.reduce((acc, curr) => acc + curr.count, 0);
    let cumulativeCount = 0;
    paretoData = [...support.topIssues].sort((a, b) => b.count - a.count).map(issue => {
      cumulativeCount += issue.count;
      return {
        type: issue.type,
        count: issue.count,
        cumulativePct: totalIssues > 0 ? (cumulativeCount / totalIssues) * 100 : 0
      };
    });
  }

  // Day of Week Heatmap (1=Sun, 7=Sat)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayVolume = new Array(7).fill(0);
  if (support?.ticketTrends) {
    support.ticketTrends.forEach(t => {
      if (t.dayOfWeek >= 1 && t.dayOfWeek <= 7) {
        dayVolume[t.dayOfWeek - 1] += t.count;
      }
    });
  }
  const maxDayVolume = Math.max(...dayVolume, 1);

  return (
    <div className="flex flex-col gap-8">

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBadge label="Total Customers" value={totalCustomers.toLocaleString()} color="#3D0A05" />
        <StatBadge label="Loyal Rate" value={`${loyalPct}%`} sub={`${loyalCount} loyal buyers`} color="#065F46" />
        <StatBadge label="Segment Revenue" value={`₹${(totalRevenue / 1000).toFixed(0)}k`} color="#BE185D" />
        <StatBadge label="Segments" value={segmentStats.length} sub="active groups" color="#7C3AED" />
      </div>

      {/* CUSTOMER CRM: New vs Returning Buyers */}
      <div className="bg-white/80 backdrop-blur-lg border border-white/90 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900 m-0 font-serif">New vs Returning Buyers</h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">Monthly buyer composition — who's coming back?</p>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-2 text-xs font-bold text-[#3D0A05]">
              <span className="w-3 h-1 rounded bg-[#3D0A05] inline-block" /> New
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-[#BE185D]">
              <span className="w-3 h-1 rounded bg-[#BE185D] inline-block" /> Returning
            </span>
          </div>
        </div>

        <div className="h-[280px]">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3D0A05" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3D0A05" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BE185D" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#BE185D" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} tickFormatter={(v) => { const [y, m] = v.split('-'); return new Date(+y, +m - 1).toLocaleString('default', { month: 'short' }); }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={32} />
                <Tooltip content={<BuyerTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Area type="monotone" dataKey="returningBuyers" name="Returning" stackId="1" stroke="#BE185D" fill="url(#colorRet)" />
                <Area type="monotone" dataKey="newBuyers" name="New" stackId="1" stroke="#3D0A05" fill="url(#colorNew)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-pink-50 rounded-full"><TrendingUp size={28} color="#BE185D" /></div>
              <p className="text-sm text-gray-400 font-semibold">No buyer trend data</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Revenue Bar */}
        <div className="bg-white/80 backdrop-blur-lg border border-white/90 rounded-3xl p-8 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2 font-serif">
            <Users size={18} color="#9CA3AF" /> Segment Revenue
          </h3>
          <p className="text-xs text-gray-500 mb-5 font-medium">Revenue generated per segment</p>
          <div className="h-[240px]">
            {segmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentStats} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="segment" type="category" width={72} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => (SEGMENT_META[v]?.label || v).toUpperCase()} />
                  <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                    {segmentStats.map((s: any) => <Cell key={s.segment} fill={SEGMENT_META[s.segment]?.color || '#D1D5DB'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">No segment data</div>
            )}
          </div>
        </div>

        {/* Retention Funnel */}
        <div className="bg-white/80 backdrop-blur-lg border border-white/90 rounded-3xl p-8 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2 font-serif">
            <Zap size={18} color="#D97706" /> Purchase Frequency
          </h3>
          <p className="text-xs text-gray-500 mb-5 font-medium">How often customers reorder</p>
          {funnelData.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {sortedFunnel.map((item: any, i: number) => {
                const max = Math.max(...sortedFunnel.map((x: any) => x.count));
                const pct = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={item._id}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-bold text-gray-700">{item._id}</span>
                      <span className="text-sm font-black" style={{ color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>{item.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">No retention data</div>
          )}
        </div>
      </div>

      {/* SECTION 2: CUSTOMER SUPPORT & TICKETING */}
      {support && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2">
            <h2 className="text-xl font-bold text-gray-900 font-serif">Customer Support & Ticketing</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resolution Times */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Clock size={18} className="text-gray-400" /> Resolution Times
              </h3>
              <p className="text-xs text-gray-500 mb-6 font-medium">First Response (FRT) vs Time to Resolve (TTR) by type</p>
              <div className="h-[250px]">
                {resolutionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resolutionData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="type" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip formatter={(v: any, n: any) => [`${Number(v).toFixed(1)} hrs`, n === 'avgFrt' ? 'Avg First Response' : 'Avg Resolution']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="avgFrt" name="avgFrt" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="avgTtr" name="avgTtr" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No resolution data</div>
                )}
              </div>
            </div>

            {/* Top Issues Pareto */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle size={18} className="text-gray-400" /> Top Issues
              </h3>
              <p className="text-xs text-gray-500 mb-6 font-medium">Ticket categorization and cumulative impact</p>
              <div className="h-[250px]">
                {paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="type" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip formatter={(v: any, n: any) => [n === 'cumulativePct' ? `${Number(v).toFixed(1)}%` : v, n === 'count' ? 'Tickets' : 'Cumulative %']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar yAxisId="left" dataKey="count" name="count" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={32} />
                      <Line yAxisId="right" type="monotone" dataKey="cumulativePct" name="cumulativePct" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No issue data</div>
                )}
              </div>
            </div>

            {/* Ticket Volume Trends (Line + Day of Week Heatmap) */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2">
              <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                <CalendarDays size={18} className="text-gray-400" /> Ticket Volume Trends
              </h3>
              <p className="text-xs text-gray-500 mb-6 font-medium">Daily ticket counts and Day-of-Week concentration</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[250px]">
                {/* Line Chart */}
                <div className="md:col-span-2 h-full">
                  {support.ticketTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={support.ticketTrends} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorTickets)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">No trend data</div>
                  )}
                </div>

                {/* Day of Week Heatmap */}
                <div className="flex flex-col justify-between">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weekly Pattern</div>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {days.map((day, i) => {
                      const vol = dayVolume[i];
                      const intensity = vol > 0 ? Math.max(0.2, vol / maxDayVolume) : 0.05;
                      return (
                        <div key={day} className="flex items-center gap-2">
                          <div className="w-10 text-xs font-semibold text-gray-600">{day}</div>
                          <div className="flex-1 h-6 rounded-md transition-all relative overflow-hidden bg-gray-100">
                            <div className="absolute inset-0 bg-purple-600" style={{ opacity: intensity }} />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white z-10 drop-shadow-md">
                              {vol > 0 ? vol : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default CustomerCRMSection;
