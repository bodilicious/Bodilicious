import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- MOCK DATA ---
const customerData = {
  overview: {
    lifetimeSessions: { value: 142, trend: [10, 15, 20, 25, 22, 18, 14] },
    avgSessionLength: { value: 4.5, trend: [5.0, 4.8, 5.2, 4.5, 4.0, 4.2, 4.5] },
    productViews: { value: 850, trend: [50, 80, 120, 150, 130, 90, 80] },
    checkoutSuccessRate: { value: 85, trend: [90, 88, 85, 80, 85, 85, 85] }
  },
  engagement: {
    monthly: [
      { month: 'Jan', sessions: 35, timeSpentHours: 3.2 },
      { month: 'Feb', sessions: 30, timeSpentHours: 2.8 },
      { month: 'Mar', sessions: 28, timeSpentHours: 2.5 },
      { month: 'Apr', sessions: 20, timeSpentHours: 1.8 },
      { month: 'May', sessions: 15, timeSpentHours: 1.5 },
      { month: 'Jun', sessions: 14, timeSpentHours: 1.2 },
    ],
    totals: { sessions: 142, timeSpentHours: 13.0 }
  },
  productAndCart: {
    cartActivity: [
      { category: 'Skincare', added: 45, removed: 20 },
      { category: 'Haircare', added: 25, removed: 15 },
      { category: 'Body', added: 15, removed: 5 },
      { category: 'Fragrance', added: 10, removed: 8 },
    ],
    topViewed: [
      { name: 'Vitamin C Serum', views: 120 },
      { name: 'Hydrating Cleanser', views: 95 },
      { name: 'SPF 50 Sunscreen', views: 80 },
      { name: 'Night Repair Cream', views: 65 },
      { name: 'Rose Water Toner', views: 50 },
    ]
  },
  checkoutHealth: {
    pie: [
      { name: 'Paid', value: 85 },
      { name: 'Failed', value: 15 }
    ],
    monthlyOutcomes: [
      { month: 'Jan', paid: 12, failed: 1 },
      { month: 'Feb', paid: 10, failed: 2 },
      { month: 'Mar', paid: 8, failed: 1 },
      { month: 'Apr', paid: 5, failed: 3 },
      { month: 'May', paid: 4, failed: 0 },
      { month: 'Jun', paid: 3, failed: 1 },
    ]
  },
  healthScore: {
    radar: [
      { subject: 'Engagement', score: 6 },
      { subject: 'Purchase Intent', score: 8 },
      { subject: 'Checkout Health', score: 9 },
      { subject: 'Loyalty', score: 7 },
      { subject: 'Value', score: 8 },
    ],
    overall: 7.6,
    verdict: "High-value loyalist, but recent engagement is slipping.",
    recommendedAction: "Trigger re-engagement email campaign highlighting new skincare arrivals, including a small retention discount to boost session activity."
  }
};

// --- THEME ---
const THEME = {
  bg: '#0f1117',
  cardBg: '#1a1d27',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  border: '#334155',
  colors: ['#6366f1', '#8b5cf6', '#22d3ee', '#38bdf8', '#a855f7'],
  grid: '#1e293b'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1d27] border border-[#334155] p-3 rounded-lg shadow-xl">
        <p className="text-gray-200 font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-400">{entry.name}:</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- COMPONENTS ---

function Sparkline({ data, color }: { data: number[], color: string }) {
  const chartData = data.map((val, i) => ({ index: i, value: val }));
  return (
    <div className="w-24 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CustomerAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');

  const tabs = ['Overview', 'Engagement', 'Product & Cart', 'Checkout Health', 'Health Score'];

  return (
    <div className="min-h-screen p-8 font-sans" style={{ backgroundColor: THEME.bg, color: THEME.textPrimary }}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Tabs */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-white">Customer Analytics</h2>
          <div className="flex border-b border-[#334155] overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                  activeTab === tab ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-indigo-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl border border-[#334155] flex items-center justify-between" style={{ backgroundColor: THEME.cardBg }}>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Lifetime Sessions</p>
                  <p className="text-3xl font-bold">{customerData.overview.lifetimeSessions.value}</p>
                </div>
                <Sparkline data={customerData.overview.lifetimeSessions.trend} color={THEME.colors[0]} />
              </div>
              
              <div className="p-5 rounded-xl border border-[#334155] flex items-center justify-between" style={{ backgroundColor: THEME.cardBg }}>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Avg Session (m)</p>
                  <p className="text-3xl font-bold">{customerData.overview.avgSessionLength.value}</p>
                </div>
                <Sparkline data={customerData.overview.avgSessionLength.trend} color={THEME.colors[1]} />
              </div>

              <div className="p-5 rounded-xl border border-[#334155] flex items-center justify-between" style={{ backgroundColor: THEME.cardBg }}>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Product Views</p>
                  <p className="text-3xl font-bold">{customerData.overview.productViews.value}</p>
                </div>
                <Sparkline data={customerData.overview.productViews.trend} color={THEME.colors[2]} />
              </div>

              <div className="p-5 rounded-xl border border-[#334155] flex items-center justify-between" style={{ backgroundColor: THEME.cardBg }}>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Checkout Success</p>
                  <p className="text-3xl font-bold">{customerData.overview.checkoutSuccessRate.value}%</p>
                </div>
                <Sparkline data={customerData.overview.checkoutSuccessRate.trend} color={THEME.colors[3]} />
              </div>
            </div>
          )}

          {/* 2. ENGAGEMENT TAB */}
          {activeTab === 'Engagement' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl border border-[#334155]" style={{ backgroundColor: THEME.cardBg }}>
                  <h3 className="text-sm font-semibold text-slate-200 mb-6">Sessions (Last 6 Months)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customerData.engagement.monthly} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} vertical={false} />
                        <XAxis dataKey="month" stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="sessions" name="Sessions" stroke={THEME.colors[0]} strokeWidth={3} dot={{ r: 4, fill: THEME.cardBg, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-[#334155]" style={{ backgroundColor: THEME.cardBg }}>
                  <h3 className="text-sm font-semibold text-slate-200 mb-6">Time Spent (Hours)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customerData.engagement.monthly} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} vertical={false} />
                        <XAxis dataKey="month" stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                        <Bar dataKey="timeSpentHours" name="Hours Spent" fill={THEME.colors[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="p-4 rounded-xl border border-[#334155] flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: THEME.cardBg }}>
                  <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Sessions (6m)</span>
                  <span className="text-2xl font-bold text-white">{customerData.engagement.totals.sessions}</span>
                </div>
                <div className="p-4 rounded-xl border border-[#334155] flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: THEME.cardBg }}>
                  <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Time (6m)</span>
                  <span className="text-2xl font-bold text-white">{customerData.engagement.totals.timeSpentHours} hrs</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. PRODUCT & CART TAB */}
          {activeTab === 'Product & Cart' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-[#334155]" style={{ backgroundColor: THEME.cardBg }}>
                <h3 className="text-sm font-semibold text-slate-200 mb-6">Cart Activity by Category</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerData.productAndCart.cartActivity} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} vertical={false} />
                      <XAxis dataKey="category" stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="added" name="Added" fill={THEME.colors[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="removed" name="Removed" fill={THEME.colors[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-[#334155]" style={{ backgroundColor: THEME.cardBg }}>
                <h3 className="text-sm font-semibold text-slate-200 mb-6">Top Viewed Products</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={customerData.productAndCart.topViewed} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} horizontal={false} />
                      <XAxis type="number" stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={140} stroke={THEME.textSecondary} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                      <Bar dataKey="views" name="Views" fill={THEME.colors[1]} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 4. CHECKOUT HEALTH TAB */}
          {activeTab === 'Checkout Health' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-[#334155] flex flex-col items-center justify-center" style={{ backgroundColor: THEME.cardBg }}>
                <h3 className="text-sm font-semibold text-slate-200 mb-2 self-start w-full">Checkout Success Rate</h3>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={customerData.checkoutHealth.pie}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill={THEME.colors[0]} />
                        <Cell fill="#ef4444" /> {/* Red for failed */}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-white">{customerData.overview.checkoutSuccessRate.value}%</span>
                    <span className="text-xs text-slate-400">Success</span>
                  </div>
                </div>
                <div className="flex gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME.colors[0] }}></div>
                    <span className="text-sm text-slate-300">Paid ({customerData.checkoutHealth.pie[0].value}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-slate-300">Failed ({customerData.checkoutHealth.pie[1].value}%)</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-[#334155]" style={{ backgroundColor: THEME.cardBg }}>
                <h3 className="text-sm font-semibold text-slate-200 mb-6">Outcomes by Month</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerData.checkoutHealth.monthlyOutcomes} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} vertical={false} />
                      <XAxis dataKey="month" stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke={THEME.textSecondary} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="paid" name="Paid Orders" stackId="a" fill={THEME.colors[0]} radius={[0, 0, 4, 4]} />
                      <Bar dataKey="failed" name="Failed Attempts" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 5. HEALTH SCORE TAB */}
          {activeTab === 'Health Score' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-[#334155] flex flex-col items-center" style={{ backgroundColor: THEME.cardBg }}>
                <h3 className="text-sm font-semibold text-slate-200 mb-2 self-start w-full">Customer Health Matrix</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={customerData.healthScore.radar}>
                      <PolarGrid stroke={THEME.grid} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: THEME.textSecondary, fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: THEME.textSecondary, fontSize: 10 }} axisLine={false} />
                      <Radar name="Score" dataKey="score" stroke={THEME.colors[0]} fill={THEME.colors[0]} fillOpacity={0.4} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-6 rounded-xl border border-[#334155] flex items-center gap-6" style={{ backgroundColor: THEME.cardBg }}>
                  <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-indigo-500 bg-indigo-500/10 shrink-0">
                    <span className="text-3xl font-bold text-white">{customerData.healthScore.overall}</span>
                    <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">/ 10</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Overall Health Score</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{customerData.healthScore.verdict}</p>
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-[#334155] border-l-4 border-l-indigo-500 flex-1 flex flex-col justify-center" style={{ backgroundColor: THEME.cardBg }}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                    <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Recommended Action</h3>
                  </div>
                  <p className="text-slate-200 leading-relaxed text-sm">
                    {customerData.healthScore.recommendedAction}
                  </p>
                  <button className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg self-start transition-colors shadow-lg shadow-indigo-900/20">
                    Execute Campaign
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
