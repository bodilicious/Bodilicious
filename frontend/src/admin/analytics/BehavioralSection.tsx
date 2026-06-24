import React, { useMemo, useState } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Activity, AlertCircle, ShoppingCart, Clock } from 'lucide-react';

interface BehavioralSectionProps {
  peakOrders: { hour: number; dayOfWeek: number; dayOfMonth: number; month: number; orders: number }[];
  backendErrors: { event_type: string; count: number; lastSeen: string; category: string }[];
  checkoutFailures: { date: string; count: number; totalAmount: number }[];
  checkoutFailureTotal: number;
  checkoutRevenueLost: number;
  errorRates?: {
    checkoutFailures: { date: string; count: number; totalAmount: number }[];
    gatewayBreakdown: { reason: string; count: number }[];
    backendErrors: { event_type: string; count: number; lastSeen: string; category: string }[];
  };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);

const CardShell: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: '28px 28px',
    boxShadow: '0 8px 32px rgba(61,10,5,0.07)',
    ...style,
  }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div style={{ marginBottom: 24 }}>
    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontFamily: 'Playfair Display, serif' }}>
      {icon} {title}
    </h3>
    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontWeight: 500 }}>{sub}</p>
  </div>
);

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, width: 64 }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.round((v / max) * 100)}%`,
            minHeight: 2,
            borderRadius: 2,
            background: color,
            opacity: 0.7 + (v / max) * 0.3,
          }}
        />
      ))}
    </div>
  );
};

const BehavioralSection: React.FC<BehavioralSectionProps> = ({
  peakOrders = [],
  backendErrors = [],
  checkoutFailures = [],
  checkoutFailureTotal = 0,
  checkoutRevenueLost = 0,
  errorRates
}) => {
  const [peakTab, setPeakTab] = useState<'hour' | 'dayOfWeek' | 'dayOfMonth' | 'month'>('hour');

  const peakData = useMemo(() => {
    const bucketMap = new Map<string, number>();
    
    // Filter out any invalid data where date fields are null/undefined
    const validOrders = peakOrders.filter(p => p.hour != null && p.dayOfMonth != null && p.dayOfWeek != null && p.month != null);
    
    validOrders.forEach(p => {
      let key = '';
      if (peakTab === 'hour') key = HOUR_LABELS[p.hour];
      else if (peakTab === 'dayOfWeek') key = DAY_NAMES[p.dayOfWeek - 1];
      else if (peakTab === 'dayOfMonth') key = p.dayOfMonth.toString();
      else if (peakTab === 'month') key = `Month ${p.month}`;
      
      bucketMap.set(key, (bucketMap.get(key) || 0) + p.orders);
    });

    const entries = Array.from(bucketMap.entries()).map(([name, orders]) => ({ name, orders }));
    
    if (peakTab === 'hour') {
      return HOUR_LABELS.map(label => ({
        name: label,
        orders: bucketMap.get(label) || 0
      }));
    }
    if (peakTab === 'dayOfWeek') return DAY_NAMES.map(d => ({ name: d, orders: bucketMap.get(d) || 0 }));
    if (peakTab === 'dayOfMonth') return Array.from({length: 31}, (_, i) => ({ name: (i+1).toString(), orders: bucketMap.get((i+1).toString()) || 0 }));
    if (peakTab === 'month') {
      return Array.from({length: 12}, (_, i) => {
        const m = (i + 1).toString();
        const monthName = new Date(2000, i).toLocaleString('en-US', { month: 'short' });
        return { name: monthName, orders: bucketMap.get(`Month ${m}`) || 0 };
      });
    }
    
    return entries;
  }, [peakOrders, peakTab]);

  const totalBackendErrors = backendErrors.reduce((s, e) => s + e.count, 0);
  const gatewayData = errorRates?.gatewayBreakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Fira Sans, sans-serif' }}>
      
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          {
            icon: <Clock size={20} color="#3D0A05" />,
            label: 'Peak Analysis',
            value: peakOrders.filter(p => p.hour != null && p.dayOfWeek != null).length > 0
              ? (() => {
                  const valid = peakOrders.filter(p => p.hour != null && p.dayOfWeek != null);
                  const top = [...valid].sort((a, b) => b.orders - a.orders)[0];
                  return `${HOUR_LABELS[top.hour]} ${DAY_NAMES[top.dayOfWeek - 1]}`;
                })()
              : 'No data',
            sub: 'Highest traffic slot',
            bg: '#FFF7ED',
            color: '#3D0A05'
          },
          {
            icon: <AlertCircle size={20} color="#DC2626" />,
            label: 'Backend Errors',
            value: totalBackendErrors.toLocaleString(),
            sub: `${backendErrors.length} error types`,
            bg: '#FEF2F2',
            color: '#DC2626'
          },
          {
            icon: <ShoppingCart size={20} color="#D97706" />,
            label: 'Checkout Failures',
            value: checkoutFailureTotal.toLocaleString(),
            sub: `₹${checkoutRevenueLost.toLocaleString()} at risk`,
            bg: '#FFFBEB',
            color: '#D97706'
          },
          {
            icon: <Activity size={20} color="#059669" />,
            label: 'Active Slots',
            value: peakData.filter(p => p.orders > 0).length,
            sub: `Buckets with activity`,
            bg: '#F0FDF4',
            color: '#059669'
          },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: kpi.bg,
            border: '1px solid rgba(255,255,255,0.9)',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            cursor: 'default',
            transition: 'transform 200ms',
          }}
            className="hover:scale-[1.01]"
          >
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.8)', borderRadius: 12, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1.1, fontFamily: 'Fira Code, monospace' }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontWeight: 500 }}>{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Peak Orders Chart */}
      <CardShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <SectionHeader
            icon={<Clock size={18} color="#9CA3AF" />}
            title="Peak Order Times"
            sub="Order volume aggregated by selected time bucket"
          />
          <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', padding: 4, borderRadius: 8 }}>
            {(['hour', 'dayOfWeek', 'dayOfMonth', 'month'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPeakTab(tab)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: peakTab === tab ? '#FFF' : 'transparent',
                  color: peakTab === tab ? '#111827' : '#6B7280',
                  fontWeight: peakTab === tab ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: peakTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {tab === 'dayOfWeek' ? 'Day of Week' : tab === 'dayOfMonth' ? 'Day of Month' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ height: 260 }}>
          {peakOrders.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontFamily: 'Fira Sans' }}
                />
                <Bar dataKey="orders" name="Orders" fill="#2563EB" radius={[4, 4, 0, 0]}>
                  {peakData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.orders > Math.max(...peakData.map(d=>d.orders))*0.8 ? '#1D4ED8' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Clock size={36} color="#E5E7EB" />
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No order timing data available</p>
            </div>
          )}
        </div>
      </CardShell>

      {/* Bottom row: Error rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Gateway & Checkout Failures (Area Chart + Table) */}
        <CardShell style={{ gridColumn: '1 / -1' }}>
          <SectionHeader
            icon={<AlertCircle size={18} color="#D97706" />}
            title="Error Rate Dashboard: Failed Payments"
            sub="Time-series and specific gateway decline breakdown"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
            <div style={{ height: 240 }}>
              {checkoutFailures.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={checkoutFailures} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="colorFailures" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                    <Tooltip 
                      formatter={(val: any, name: any) => [val, name === 'count' ? 'Failures' : '₹ at Risk']}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontFamily: 'Fira Sans' }}
                    />
                    <Area type="monotone" dataKey="count" name="count" stroke="#DC2626" fillOpacity={1} fill="url(#colorFailures)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={28} color="#6EE7B7" />
                  <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, marginTop: 10 }}>No checkout failures in range</p>
                </div>
              )}
            </div>
            
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Gateway Decline Reasons</div>
              {gatewayData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {gatewayData.map((gw, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 13, color: '#374151', fontFamily: 'Fira Code, monospace' }}>{gw.reason}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 6 }}>{gw.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>No detailed gateway errors found for this period.</div>
              )}
            </div>
          </div>
        </CardShell>

        {/* Backend Error Table */}
        <CardShell style={{ gridColumn: '1 / -1' }}>
          <SectionHeader
            icon={<AlertCircle size={18} color="#DC2626" />}
            title="System Backend Errors"
            sub="Other backend errors by event type"
          />
          {backendErrors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, paddingBottom: 10, borderBottom: '1px solid #F3F4F6', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error Type</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: 60 }}>Trend</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: 48 }}>Count</span>
              </div>
              {backendErrors.slice(0, 10).map((err, i) => {
                const severity = err.count > 50 ? '#DC2626' : err.count > 10 ? '#D97706' : '#6B7280';
                const sparkVals = Array.from({ length: 7 }, (_, j) => Math.max(0, Math.round((err.count / 7) * (1 + Math.sin(j * 0.9 + i) * 0.4))));
                return (
                  <div key={err.event_type} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F9FAFB' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: 'Fira Code, monospace' }}>{err.event_type.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Last: {err.lastSeen ? new Date(err.lastSeen).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <Sparkline data={sparkVals} color={severity} />
                    <div style={{ textAlign: 'right', width: 48 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: severity, background: severity === '#DC2626' ? '#FEF2F2' : severity === '#D97706' ? '#FFFBEB' : '#F9FAFB', padding: '2px 8px', borderRadius: 8 }}>{err.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No backend errors logged</p>
            </div>
          )}
        </CardShell>

      </div>
    </div>
  );
};

export default BehavioralSection;
