import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { Users, TrendingUp, Zap } from 'lucide-react';

interface CustomerCRMSectionProps {
  segmentStats: any[];
  funnelData: any[];
  trendData?: any[]; // New vs Returning buyer trend
  loading?: boolean;
}

const SEGMENT_META: Record<string, { color: string; label: string }> = {
  new:        { color: '#BE185D', label: 'New' },
  loyal:      { color: '#3D0A05', label: 'Loyal' },
  at_risk:    { color: '#D97706', label: 'At Risk' },
  high_value: { color: '#065F46', label: 'High Value' },
};

const FUNNEL_COLORS = ['#3D0A05', '#7C3AED', '#BE185D', '#0891B2'];

// Custom tooltip for the Area chart
const BuyerTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 14,
      padding: '12px 16px',
      boxShadow: '0 10px 40px rgba(61,10,5,0.12)',
      border: '1px solid rgba(61,10,5,0.08)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const StatBadge: React.FC<{ label: string; value: string | number; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div style={{
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 4px 24px rgba(61,10,5,0.06)',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  }}
    className="hover:shadow-lg cursor-default"
  >
    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1, fontFamily: 'Playfair Display, serif' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{sub}</div>}
  </div>
);

const CustomerCRMSection: React.FC<CustomerCRMSectionProps> = ({
  segmentStats,
  funnelData,
  trendData = [],
}) => {
  const totalCustomers = segmentStats.reduce((s, x) => s + x.customerCount, 0);
  const totalRevenue = segmentStats.reduce((s, x) => s + x.revenue, 0);
  const loyalCount = segmentStats.find(s => s.segment === 'loyal')?.customerCount || 0;
  const loyalPct = totalCustomers > 0 ? ((loyalCount / totalCustomers) * 100).toFixed(0) : 0;

  // Sorted funnel data for display
  const funnelOrder = ['New', '2nd Purchase', '3rd Purchase', 'Loyal (4+)'];
  const sortedFunnel = [...funnelData].sort((a, b) => funnelOrder.indexOf(a._id) - funnelOrder.indexOf(b._id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatBadge label="Total Customers" value={totalCustomers.toLocaleString()} color="#3D0A05" />
        <StatBadge label="Loyal Rate" value={`${loyalPct}%`} sub={`${loyalCount} loyal buyers`} color="#065F46" />
        <StatBadge label="Segment Revenue" value={`₹${(totalRevenue / 1000).toFixed(0)}k`} color="#BE185D" />
        <StatBadge label="Segments" value={segmentStats.length} sub="active groups" color="#7C3AED" />
      </div>

      {/* New vs Returning Buyers — Stacked Area */}
      <div style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.9)',
        borderRadius: 24,
        padding: '28px 32px',
        boxShadow: '0 8px 32px rgba(61,10,5,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0, fontFamily: 'Playfair Display, serif' }}>
              New vs Returning Buyers
            </h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontWeight: 500 }}>Monthly buyer composition — who's coming back?</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#3D0A05' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#3D0A05', display: 'inline-block' }} />
              New
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#BE185D' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#BE185D', display: 'inline-block' }} />
              Returning
            </span>
          </div>
        </div>

        <div style={{ height: 280 }}>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3D0A05" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3D0A05" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReturning" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BE185D" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#BE185D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(v) => {
                    const [y, m] = v.split('-');
                    return new Date(+y, +m - 1).toLocaleString('default', { month: 'short' });
                  }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={32} />
                <Tooltip content={<BuyerTooltip />} />
                <Area type="monotone" dataKey="newBuyers" name="New" stroke="#3D0A05" strokeWidth={2.5} fill="url(#gradNew)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#3D0A05' }} />
                <Area type="monotone" dataKey="returningBuyers" name="Returning" stroke="#BE185D" strokeWidth={2.5} fill="url(#gradReturning)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#BE185D' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ padding: 16, background: '#FDF2F8', borderRadius: '50%' }}>
                <TrendingUp size={28} color="#BE185D" />
              </div>
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No buyer trend data for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Segment Revenue + Retention Funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>

        {/* Segment Revenue Bar */}
        <div style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.9)',
          borderRadius: 24,
          padding: '28px 28px',
          boxShadow: '0 8px 32px rgba(61,10,5,0.07)',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display, serif' }}>
            <Users size={18} color="#9CA3AF" /> Segment Revenue
          </h3>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20, fontWeight: 500 }}>Revenue generated per segment</p>
          <div style={{ height: 240 }}>
            {segmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentStats} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="segment"
                    type="category"
                    width={72}
                    tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (SEGMENT_META[v]?.label || v).toUpperCase()}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter,sans-serif' }}
                  />
                  <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                    {segmentStats.map((s: any) => (
                      <Cell key={s.segment} fill={SEGMENT_META[s.segment]?.color || '#D1D5DB'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>No segment data</p>
              </div>
            )}
          </div>
        </div>

        {/* Retention Funnel */}
        <div style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.9)',
          borderRadius: 24,
          padding: '28px 28px',
          boxShadow: '0 8px 32px rgba(61,10,5,0.07)',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display, serif' }}>
            <Zap size={18} color="#D97706" /> Purchase Frequency
          </h3>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20, fontWeight: 500 }}>How often customers reorder</p>
          {funnelData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sortedFunnel.map((item: any, i: number) => {
                const max = Math.max(...sortedFunnel.map((x: any) => x.count));
                const pct = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={item._id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{item._id}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}>{item.count.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 8,
                        background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                        transition: 'width 600ms cubic-bezier(0.34,1.56,0.64,1)'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>No retention data yet</p>
            </div>
          )}

          {/* Segment CLV badges */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg CLV by Segment</p>
            {segmentStats.filter(s => s.clv > 0).map((s: any) => (
              <div key={s.segment} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{(SEGMENT_META[s.segment]?.label || s.segment).toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: SEGMENT_META[s.segment]?.color || '#111827' }}>₹{s.clv.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCRMSection;
