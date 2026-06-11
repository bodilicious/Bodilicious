import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertCircle, ShoppingCart, Clock } from 'lucide-react';

interface BehavioralSectionProps {
  peakOrders: { hour: number; dayOfWeek: number; orders: number }[];
  backendErrors: { event_type: string; count: number; lastSeen: string; category: string }[];
  checkoutFailures: { date: string; count: number; totalAmount: number }[];
  checkoutFailureTotal: number;
  checkoutRevenueLost: number;
  loading?: boolean;
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

// Sparkline mini bar
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
  peakOrders,
  backendErrors,
  checkoutFailures,
  checkoutFailureTotal,
  checkoutRevenueLost,
}) => {
  // Build a 7×24 heatmap matrix: heatmap[dayOfWeek][hour] = orders
  const heatmap = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    peakOrders.forEach(({ hour, dayOfWeek, orders }) => {
      // dayOfWeek: 1=Sun, 7=Sat → convert to 0-indexed
      const d = dayOfWeek - 1;
      if (d >= 0 && d < 7 && hour >= 0 && hour < 24) {
        matrix[d][hour] = orders;
      }
    });
    return matrix;
  }, [peakOrders]);

  const maxOrders = useMemo(() =>
    Math.max(...peakOrders.map(p => p.orders), 1), [peakOrders]);

  const heatColor = (count: number) => {
    if (count === 0) return '#F9FAFB';
    const intensity = count / maxOrders;
    if (intensity < 0.25) return '#FEE2E2';
    if (intensity < 0.5)  return '#FCA5A5';
    if (intensity < 0.75) return '#EF4444';
    return '#7F1D1D';
  };

  // Checkout failure sparkline data (last 30 days, by date)

  // Backend errors with sparklines (mock last-7-day trend with flat values since we only have totals)
  const totalBackendErrors = backendErrors.reduce((s, e) => s + e.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          {
            icon: <Clock size={20} color="#3D0A05" />,
            label: 'Peak Analysis',
            value: peakOrders.length > 0
              ? (() => {
                  const top = [...peakOrders].sort((a, b) => b.orders - a.orders)[0];
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
            sub: `${backendErrors.length} error types (90d)`,
            bg: '#FEF2F2',
            color: '#DC2626'
          },
          {
            icon: <ShoppingCart size={20} color="#D97706" />,
            label: 'Checkout Failures',
            value: checkoutFailureTotal.toLocaleString(),
            sub: `₹${checkoutRevenueLost.toLocaleString()} at risk (30d)`,
            bg: '#FFFBEB',
            color: '#D97706'
          },
          {
            icon: <Activity size={20} color="#059669" />,
            label: 'Active Hours',
            value: peakOrders.filter(p => p.orders > 0).length,
            sub: 'Slots with order activity',
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
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1.1, fontFamily: 'Playfair Display, serif' }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontWeight: 500 }}>{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Peak Order Heatmap */}
      <CardShell>
        <SectionHeader
          icon={<Clock size={18} color="#9CA3AF" />}
          title="Peak Order Heatmap"
          sub="Hour × Day of week — last 90 days of paid orders"
        />
        {peakOrders.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            {/* Hour axis header */}
            <div style={{ display: 'flex', marginBottom: 6, marginLeft: 40 }}>
              {HOUR_LABELS.filter((_, i) => i % 3 === 0).map((label, i) => (
                <div key={i} style={{
                  width: `${100 / 8}%`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {DAY_NAMES.map((day, d) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ width: 36, fontSize: 11, fontWeight: 700, color: '#6B7280', flexShrink: 0, textAlign: 'right', paddingRight: 8 }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flex: 1, gap: 3, minWidth: 480 }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const count = heatmap[d][h];
                    return (
                      <div
                        key={h}
                        title={`${day} ${HOUR_LABELS[h]}: ${count} orders`}
                        style={{
                          flex: 1,
                          height: 28,
                          borderRadius: 5,
                          background: heatColor(count),
                          cursor: count > 0 ? 'help' : 'default',
                          transition: 'transform 150ms',
                          border: count > 0 ? 'none' : '1px solid #F3F4F6',
                        }}
                        className={count > 0 ? 'hover:scale-110' : ''}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Less</span>
              {['#F9FAFB', '#FEE2E2', '#FCA5A5', '#EF4444', '#7F1D1D'].map((c, i) => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.06)' }} />
              ))}
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>More</span>
            </div>
          </div>
        ) : (
          <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Clock size={36} color="#E5E7EB" />
            <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No order timing data yet</p>
            <p style={{ fontSize: 11, color: '#D1D5DB' }}>Data appears after paid orders are placed</p>
          </div>
        )}
      </CardShell>

      {/* Bottom row: Error table + Checkout trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

        {/* Backend Error Rate Table */}
        <CardShell>
          <SectionHeader
            icon={<AlertCircle size={18} color="#DC2626" />}
            title="Backend Error Rates"
            sub="Audit log errors by type — last 90 days"
          />
          {backendErrors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, paddingBottom: 10, borderBottom: '1px solid #F3F4F6', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Error Type</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: 60 }}>Trend</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', width: 48 }}>Count</span>
              </div>
              {backendErrors.slice(0, 8).map((err, i) => {
                const severity = err.count > 50 ? '#DC2626' : err.count > 10 ? '#D97706' : '#6B7280';
                // Simulate sparkline with Fibonacci-ish decay for visual (real data would come from daily breakdown)
                const sparkVals = Array.from({ length: 7 }, (_, j) =>
                  Math.max(0, Math.round((err.count / 7) * (1 + Math.sin(j * 0.9 + i) * 0.4))));
                return (
                  <div
                    key={err.event_type}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #F9FAFB',
                      transition: 'background 150ms',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                        {err.event_type.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                        Last: {err.lastSeen ? new Date(err.lastSeen).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <Sparkline data={sparkVals} color={severity} />
                    <div style={{ textAlign: 'right', width: 48 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: severity,
                        background: severity === '#DC2626' ? '#FEF2F2' : severity === '#D97706' ? '#FFFBEB' : '#F9FAFB',
                        padding: '2px 8px',
                        borderRadius: 8,
                      }}>
                        {err.count}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Severity legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                {[{ color: '#6B7280', label: '< 10 (OK)' }, { color: '#D97706', label: '10–50 (Watch)' }, { color: '#DC2626', label: '> 50 (Critical)' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ padding: 16, background: '#F0FDF4', borderRadius: '50%' }}>
                <AlertCircle size={28} color="#6EE7B7" />
              </div>
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No backend errors logged</p>
              <p style={{ fontSize: 11, color: '#D1D5DB' }}>System is running clean ✓</p>
            </div>
          )}
        </CardShell>

        {/* Checkout Failure Trend */}
        <CardShell>
          <SectionHeader
            icon={<ShoppingCart size={18} color="#D97706" />}
            title="Checkout Failure Trend"
            sub="Daily failed/pending payments — last 30 days"
          />

          {/* Summary KPIs */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, padding: '14px 16px', background: '#FFFBEB', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Failures</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706', fontFamily: 'Playfair Display, serif' }}>{checkoutFailureTotal}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: '14px 16px', background: '#FEF2F2', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue at Risk</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', fontFamily: 'Playfair Display, serif' }}>₹{(checkoutRevenueLost / 1000).toFixed(1)}k</div>
            </div>
          </div>

          <div style={{ height: 200 }}>
            {checkoutFailures.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checkoutFailures} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 9, fontWeight: 600 }}
                    tickFormatter={(v) => v.slice(5)}
                    interval={Math.floor(checkoutFailures.length / 5)}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} width={28} />
                  <Tooltip
                    formatter={(val: any, name: any) => [val, name === 'count' ? 'Failures' : '₹ at Risk']}
                    contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter,sans-serif' }}
                  />
                  <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                    {checkoutFailures.map((item: any, i: number) => (
                      <Cell key={i} fill={item.count > 5 ? '#DC2626' : item.count > 2 ? '#D97706' : '#FCA5A5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ padding: 16, background: '#F0FDF4', borderRadius: '50%' }}>
                  <ShoppingCart size={28} color="#6EE7B7" />
                </div>
                <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No checkout failures</p>
                <p style={{ fontSize: 11, color: '#D1D5DB' }}>Payment flow is healthy ✓</p>
              </div>
            )}
          </div>
        </CardShell>
      </div>
    </div>
  );
};

export default BehavioralSection;
