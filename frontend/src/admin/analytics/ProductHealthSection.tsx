import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector
} from 'recharts';
import { Package, RefreshCw, Trophy, TrendingUp } from 'lucide-react';

interface ProductHealthSectionProps {
  topSelling: any[];
  categoryRevenue: any[];
  returnRates: any[];
  loading?: boolean;
}

const BRAND_PALETTE = ['#3D0A05', '#7C3AED', '#BE185D', '#0891B2', '#059669', '#D97706', '#DC2626'];

// Custom active donut sector
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#111827" style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Playfair Display, serif' }}>
        {payload.name || payload._id}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#6B7280" style={{ fontSize: 13, fontWeight: 600 }}>
        ₹{Number(value).toLocaleString()}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill="#9CA3AF" style={{ fontSize: 11 }}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const CardShell: React.FC<{ children: React.ReactNode; fullWidth?: boolean }> = ({ children, fullWidth }) => (
  <div style={{
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: '28px 28px',
    boxShadow: '0 8px 32px rgba(61,10,5,0.07)',
    gridColumn: fullWidth ? '1 / -1' : undefined,
  }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div style={{ marginBottom: 22 }}>
    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontFamily: 'Playfair Display, serif' }}>
      {icon} {title}
    </h3>
    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontWeight: 500 }}>{sub}</p>
  </div>
);

const ProductHealthSection: React.FC<ProductHealthSectionProps> = ({
  topSelling,
  categoryRevenue,
  returnRates
}) => {
  const [activeCatIndex, setActiveCatIndex] = useState(0);

  // Format top selling for horizontal bar chart
  const topSellingData = topSelling.map(p => ({
    name: p.productInfo?.name?.split(' ').slice(0, 3).join(' ') || 'Unknown',
    units: p.totalSold,
    revenue: p.revenue,
  })).slice(0, 8);

  const categoryData = categoryRevenue.map(c => ({
    ...c,
    name: c._id || 'Other',
  }));

  const maxUnits = Math.max(...topSellingData.map(p => p.units), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Top Row: Category Donut + Top Products Horizontal Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>

        {/* Category Revenue Donut */}
        <CardShell>
          <SectionHeader
            icon={<Package size={18} color="#9CA3AF" />}
            title="Revenue by Category"
            sub="Interactive donut — hover to explore"
          />
          <div style={{ height: 280 }}>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeCatIndex}
                    activeShape={renderActiveShape}
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={4}
                    dataKey="revenue"
                    nameKey="name"
                    onMouseEnter={(_, index) => setActiveCatIndex(index)}
                  >
                    {categoryData.map((_item: any, index: number) => (
                      <Cell key={`cell-cat-${index}`} fill={BRAND_PALETTE[index % BRAND_PALETTE.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Package size={32} color="#E5E7EB" />
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>No category sales yet</p>
              </div>
            )}
          </div>

          {/* Legend */}
          {categoryData.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
              {categoryData.map((c: any, i: number) => (
                <div
                  key={c._id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: activeCatIndex === i ? 1 : 0.5, transition: 'opacity 200ms' }}
                  onMouseEnter={() => setActiveCatIndex(i)}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: BRAND_PALETTE[i % BRAND_PALETTE.length], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardShell>

        {/* Top Selling — Clean Horizontal Bars */}
        <CardShell>
          <SectionHeader
            icon={<Trophy size={18} color="#D97706" />}
            title="Top Selling Products"
            sub="Units sold in selected period"
          />
          {topSellingData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topSellingData.map((p, i) => {
                const pct = (p.units / maxUnits) * 100;
                return (
                  <div key={p.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', maxWidth: '65%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: BRAND_PALETTE[i % BRAND_PALETTE.length], marginRight: 6 }}>#{i + 1}</span>
                        {p.name}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: BRAND_PALETTE[i % BRAND_PALETTE.length] }}>{p.units} units</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 8, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 8,
                        background: `linear-gradient(90deg, ${BRAND_PALETTE[i % BRAND_PALETTE.length]}, ${BRAND_PALETTE[(i + 1) % BRAND_PALETTE.length]}80)`,
                        transition: 'width 700ms cubic-bezier(0.34,1.56,0.64,1)'
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, fontWeight: 500 }}>Revenue: ₹{p.revenue?.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <TrendingUp size={32} color="#E5E7EB" />
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>No sales data for this period</p>
            </div>
          )}
        </CardShell>
      </div>

      {/* Return Rate Chart — full width */}
      <CardShell fullWidth>
        <SectionHeader
          icon={<RefreshCw size={18} color="#DC2626" />}
          title="Return Rate by SKU"
          sub="Top products by return rate — identify quality issues early"
        />
        <div style={{ height: 280 }}>
          {returnRates.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnRates.slice(0, 10)} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Return Rate']}
                  contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontFamily: 'Inter,sans-serif' }}
                />
                <Bar dataKey="returnRate" name="Return Rate" radius={[6, 6, 0, 0]}>
                  {returnRates.map((item: any, i: number) => {
                    const intensity = item.returnRate > 20 ? '#DC2626' : item.returnRate > 10 ? '#D97706' : '#059669';
                    return <Cell key={`rr-${i}`} fill={intensity} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ padding: 16, background: '#FEF2F2', borderRadius: '50%' }}>
                <RefreshCw size={28} color="#FCA5A5" />
              </div>
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No return data recorded yet</p>
              <p style={{ fontSize: 11, color: '#D1D5DB' }}>Return data will appear once orders are processed</p>
            </div>
          )}
        </div>

        {/* Return rate legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          {[{ color: '#059669', label: 'Healthy (< 10%)' }, { color: '#D97706', label: 'Monitor (10–20%)' }, { color: '#DC2626', label: 'Urgent (> 20%)' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  );
};

export default ProductHealthSection;
