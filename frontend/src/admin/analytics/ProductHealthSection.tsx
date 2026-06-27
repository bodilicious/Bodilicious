import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector
} from 'recharts';
import { Package, RefreshCw, TrendingUp, Clock, CalendarDays } from 'lucide-react';

interface ProductHealthSectionProps {
  topSelling: any[];
  categoryRevenue: any[];
  returnRates: any[];
  refundProcessing?: {
    histogram: Array<{ _id: number | string; count: number }>;
    monthlyTrend: Array<{ month: string; avgProcessingDays: number }>;
    gauge: Array<{ _id: null; overallAvg: number }>;
  };
  loading?: boolean;
}

const BRAND_PALETTE = ['#3D0A05', '#7C3AED', '#BE185D', '#0891B2', '#059669', '#D97706', '#DC2626'];

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
  returnRates,
  refundProcessing
}) => {
  const [activeCatIndex, setActiveCatIndex] = useState(0);
  const [minVolume, setMinVolume] = useState(0);

  const categoryRevenueMap = React.useMemo(() => {
    const map = new Map();
    categoryRevenue.forEach(c => map.set(c._id || 'Other', c.revenue));
    return map;
  }, [categoryRevenue]);

  const topSellingData = topSelling.map(p => {
    const cat = p.productInfo?.category || 'Other';
    const catRev = categoryRevenueMap.get(cat) || 1;
    return {
      name: p.productInfo?.name?.split(' ').slice(0, 3).join(' ') || 'Unknown',
      category: cat,
      units: p.totalSold,
      revenue: p.revenue,
      pctOfCategory: Math.min(100, (p.revenue / catRev) * 100)
    };
  });

  const categoryData = categoryRevenue.map(c => ({
    ...c,
    name: c._id || 'Other',
  }));

  const filteredReturnRates = returnRates.filter(r => r.unitsSold >= minVolume);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Top Row: Category Donut + Top Products Horizontal Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
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
                    {...({
                      activeIndex: activeCatIndex,
                      activeShape: renderActiveShape
                    } as any)}
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

        {/* All Products — Data Dense Table */}
        <CardShell>
          <SectionHeader
            icon={<TrendingUp size={18} color="#059669" />}
            title="Product Revenue Performance"
            sub="Revenue performance across all products within category"
          />
          {topSellingData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 280, overflowY: 'auto' }} className="custom-scrollbar pr-2">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 8, paddingBottom: 10, borderBottom: '1px solid #F3F4F6', marginBottom: 8, position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', zIndex: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product / Category</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Units</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>% of Category</span>
              </div>
              {topSellingData.map((p, i) => (
                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F9FAFB' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontFamily: 'Fira Code, monospace' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>{p.category}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280', textAlign: 'right' }}>{p.units}</div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_PALETTE[i % BRAND_PALETTE.length] }}>{p.pctOfCategory.toFixed(1)}%</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>₹{p.revenue?.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.pctOfCategory}%`, borderRadius: 6, background: BRAND_PALETTE[i % BRAND_PALETTE.length], transition: 'width 700ms cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <TrendingUp size={32} color="#E5E7EB" />
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>No sales data for this period</p>
            </div>
          )}
        </CardShell>
      </div>

      {/* SECTION 3: Returns & Refunds */}
      <div className="flex items-center gap-2 mt-4 mb-2">
        <h2 className="text-xl font-bold text-gray-900 font-serif">Returns & Refunds</h2>
      </div>

      <CardShell fullWidth>
        <div className="flex justify-between items-start mb-6">
          <SectionHeader
            icon={<RefreshCw size={18} color="#DC2626" />}
            title="Return Rate by SKU"
            sub="Top products by return rate — identify quality issues early"
          />
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <span className="font-medium text-xs uppercase tracking-wider">Min Volume:</span>
            <select 
              className="bg-transparent font-bold outline-none cursor-pointer"
              value={minVolume}
              onChange={e => setMinVolume(Number(e.target.value))}
            >
              <option value={0}>All</option>
              <option value={5}>5+ units</option>
              <option value={10}>10+ units</option>
              <option value={50}>50+ units</option>
            </select>
          </div>
        </div>
        <div style={{ height: 280 }}>
          {filteredReturnRates.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredReturnRates.slice(0, 10)} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }} interval={0} angle={-25} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(val: any) => [`${val}%`, 'Return Rate']} contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="returnRate" name="Return Rate" radius={[6, 6, 0, 0]}>
                  {filteredReturnRates.map((item: any, i: number) => {
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
              <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>No return data recorded yet for this volume</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          {[{ color: '#059669', label: 'Healthy (< 10%)' }, { color: '#D97706', label: 'Monitor (10–20%)' }, { color: '#DC2626', label: 'Urgent (> 20%)' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </CardShell>

      {/* SECTION 3.2: Refund Processing Time */}
      {refundProcessing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardShell>
            <div className="flex flex-col h-full justify-center items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 border-4 border-blue-100">
                <Clock className="text-blue-600" size={28} />
              </div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Avg Processing Time</h4>
              <div className="text-5xl font-black text-gray-900 font-serif">
                {refundProcessing.gauge?.[0]?.overallAvg ? refundProcessing.gauge[0].overallAvg.toFixed(1) : '—'}
                <span className="text-lg text-gray-400 ml-1">Days</span>
              </div>
              <p className="text-sm text-gray-400 mt-2 font-medium">from request to resolution</p>
            </div>
          </CardShell>

          <div className="lg:col-span-2">
            <CardShell>
              <div className="flex justify-between items-center mb-4">
                <SectionHeader icon={<CalendarDays size={18} color="#3B82F6" />} title="Processing Time Distribution" sub="Histogram of days taken to resolve refunds" />
              </div>
              <div className="h-[200px]">
                {refundProcessing.histogram?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={refundProcessing.histogram} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} tickFormatter={v => v === 'Other' ? '>7 Days' : `${v}-${Number(v) + 1} Days`} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <Tooltip formatter={(v: any) => [v, 'Refunds']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No processing data available</div>
                )}
              </div>
            </CardShell>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductHealthSection;
