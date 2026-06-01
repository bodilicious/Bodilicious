import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Users, ShoppingCart, IndianRupee,
  Activity, Package, Calendar, RefreshCw, TrendingDown,
  Bell, Eye, MousePointerClick, CreditCard, AlertTriangle,
  BarChart3, ArrowRight, Download, BrainCircuit, ActivitySquare, AlertOctagon
} from 'lucide-react';
import Papa from 'papaparse';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Select from '../components/Select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, Cell, Legend
} from 'recharts';

type Tab = 'overview' | 'live' | 'marketing' | 'funnel' | 'behavioral' | 'intelligence' | 'search' | 'cohorts' | 'at-risk' | 'stock';

const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899'];

const AnalyticsPage: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [trendingData, setTrendingData] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [lowStockData, setLowStockData] = useState<any[]>([]);
  const [behavioralData, setBehavioralData] = useState<any>(null);
  const [intelligenceData, setIntelligenceData] = useState<any[]>([]);
  const [atRiskData, setAtRiskData] = useState<any[]>([]);
  const [marketingData, setMarketingData] = useState<any[]>([]);
  const [searchData, setSearchData] = useState<any>(null);
  const [inventoryForecast, setInventoryForecast] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<{ activeVisitors: number, events: any[] }>({ activeVisitors: 0, events: [] });
  const [timeRange, setTimeRange] = useState('30');

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      const [summaryRes, trendingRes, cohortRes, funnelRes, stockRes, behavioralRes, intelligenceRes, atRiskRes, marketingRes, searchRes, forecastRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/analytics/executive-summary?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/trending-products?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/cohorts`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/product-funnel?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/low-stock`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/behavioral`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/product-intelligence`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/customers-at-risk`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/marketing`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/search-stats`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/inventory-forecast`, { headers }),
      ]);

      const [summary, trending, cohorts, funnel, stock, behavioral, intelligence, atRisk, marketing, search, forecast] = await Promise.all([
        summaryRes.json(),
        trendingRes.json(),
        cohortRes.json(),
        funnelRes.json(),
        stockRes.json(),
        behavioralRes.json(),
        intelligenceRes.json(),
        atRiskRes.json(),
        marketingRes.json(),
        searchRes.json(),
        forecastRes.json(),
      ]);

      if (summary.success) setSummaryData(summary.data);
      if (trending.success) setTrendingData(trending.data);
      if (cohorts.success) setCohortData(cohorts.data);
      if (funnel.success) setFunnelData(funnel.data);
      if (stock.success) setLowStockData(stock.data);
      if (behavioral.success) setBehavioralData(behavioral.data);
      if (intelligence.success) setIntelligenceData(intelligence.data);
      if (atRisk.success) setAtRiskData(atRisk.data);
      if (marketing.success) setMarketingData(marketing.data);
      if (search.success) setSearchData(search.data);
      if (forecast.success) setInventoryForecast(forecast.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup EventSource for Live View
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const initLive = async () => {
      try {
        const headers: any = await getAuthHeaders();
        const token = headers.Authorization ? headers.Authorization.split(' ')[1] : '';
        eventSource = new EventSource(`${API_URL}/api/v1/admin/analytics/live?token=${token}`);
        
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'SYNC') {
            setLiveData(prev => ({ ...prev, activeVisitors: data.activeVisitors }));
          } else {
            setLiveData(prev => ({
              activeVisitors: data.activeVisitors,
              events: [data, ...prev.events].slice(0, 50) // Keep last 50 events
            }));
          }
        };
      } catch (err) {
        console.error('Failed to init live view', err);
      }
    };

    initLive();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [API_URL, getAuthHeaders]);

  const fmt = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'live', label: 'Live View', icon: Activity },
    { id: 'marketing', label: 'Marketing', icon: TrendingUp },
    { id: 'search', label: 'Storefront', icon: Eye },
    { id: 'behavioral', label: 'Behavioral', icon: ActivitySquare },
    { id: 'funnel', label: 'Product Funnel', icon: MousePointerClick },
    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
    { id: 'cohorts', label: 'Retention', icon: Users },
    { id: 'at-risk', label: 'At Risk', icon: AlertOctagon },
    { id: 'stock', label: 'Inventory Health', icon: AlertTriangle },
  ];

  const exportAtRiskToCSV = () => {
    if (!atRiskData || atRiskData.length === 0) return;
    const csv = Papa.unparse(atRiskData.map(c => ({
      'Name': c.name,
      'Email': c.email,
      'Phone': c.phone || 'N/A',
      'Last Order Date': new Date(c.lastOrderDate).toLocaleDateString(),
      'Days Since Last Order': Math.floor(c.daysSinceLastOrder),
      'Expected Product Lifespan': c.maxLifespanDays
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_at_risk_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border border-gray-100 gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm text-dark-red border border-gray-100">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Analytics</h3>
            <p className="text-sm text-gray-500">Revenue, product funnel, retention & inventory health</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select
            className="flex-1 md:flex-none w-40"
            value={timeRange}
            onChange={(val) => setTimeRange(val as string)}
            options={[
              { value: '7', label: 'Last 7 Days' },
              { value: '30', label: 'Last 30 Days' },
              { value: '90', label: 'Last 90 Days' },
              { value: '365', label: 'Last 365 Days' }
            ]}
          />
          <button
            onClick={fetchData}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-dark-red hover:bg-red-50 transition-colors shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grade A Low Stock Alert */}
      {inventoryForecast && inventoryForecast.some((p: any) => p.grade === 'A' && p.daysRemaining < 14) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-6 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-red-800 font-bold">Critical Action Required: Grade A Stockout Risk</h4>
            <p className="text-sm text-red-700 mt-1">
              The following high-revenue products have less than 14 days of inventory remaining:
            </p>
            <ul className="list-disc list-outside pl-4 mt-2 text-sm text-red-700">
              {inventoryForecast.filter((p: any) => p.grade === 'A' && p.daysRemaining < 14).map((p: any) => (
                <li key={p._id}>
                  <span className="font-semibold">{p.name}</span> — {p.daysRemaining} days left ({p.stock} units)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Control Panel Navigation (No Scrollbars) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-grow sm:flex-grow-0 justify-center whitespace-nowrap ${
              activeTab === id
                ? 'bg-dark-red text-white shadow-md'
                : 'bg-gray-50 text-gray-600 hover:text-dark-red hover:bg-[#F5F2EC]'
            }`}
          >
            <Icon size={16} />
            {label}
            {id === 'stock' && lowStockData.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {lowStockData.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !summaryData ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin text-dark-red"><RefreshCw size={32} /></div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ─── TAB 1: OVERVIEW ─── */}
          {activeTab === 'overview' && summaryData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    label: 'Net Revenue', value: fmt(summaryData.summary.netRevenue),
                    icon: IndianRupee, bg: 'bg-green-50', fg: 'text-green-600'
                  },
                  {
                    label: 'Total Orders', value: summaryData.summary.orders,
                    icon: ShoppingCart, bg: 'bg-blue-50', fg: 'text-blue-600'
                  },
                  {
                    label: 'Avg Order Value', value: fmt(summaryData.summary.averageOrderValue),
                    icon: TrendingUp, bg: 'bg-purple-50', fg: 'text-purple-600'
                  },
                ].map(({ label, value, icon: Icon, bg, fg }) => (
                  <div key={label} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-normal text-gray-400 tracking-wider">{label}</p>
                      <div className={`w-8 h-8 rounded-lg ${bg} ${fg} flex items-center justify-center`}>
                        <Icon size={16} />
                      </div>
                    </div>
                    <h3 className="text-3xl font-medium text-gray-800">{value}</h3>
                  </div>
                ))}
              </div>

              {/* Revenue Chart */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-6">Revenue Trend (Net vs Gross)</h4>
                <div className="h-80 w-full relative">
                  {summaryData.chartData?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summaryData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b0000" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#8b0000" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                          dataKey="date_string"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                          formatter={(value: any) => fmt(Number(value))}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Area type="monotone" dataKey="net_revenue" name="Net Revenue" stroke="#8b0000" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                        <Line type="monotone" dataKey="gross_revenue" name="Gross Revenue" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <TrendingDown size={32} className="text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-400">No revenue data available for this period</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Products by Sales (Quick view) */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <Package className="text-dark-red" size={18} /> Top Selling Products
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                        <th className="p-4 pl-6">Rank</th>
                        <th className="p-4">Product</th>
                        <th className="p-4 text-right">Units</th>
                        <th className="p-4 text-right pr-6">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {trendingData.length > 0 ? trendingData.slice(0, 5).map((item, index) => (
                        <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 pl-6 text-sm font-bold text-gray-400">#{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.images?.[0] ? (
                                <img src={item.images[0]} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100" />
                              )}
                              <p className="font-bold text-gray-800 text-sm max-w-[280px] truncate">{item.name}</p>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium text-gray-800">{item.totalPurchases}</td>
                          <td className="p-4 text-right pr-6 font-medium text-dark-red">{fmt(item.totalRevenue)}</td>
                        </tr>
                      )) : (
                        [1, 2, 3].map((skeleton) => (
                          <tr key={skeleton}>
                            <td className="p-4 pl-6"><div className="w-6 h-4 bg-gray-100 rounded animate-pulse" /></td>
                            <td className="p-4 flex items-center gap-3">
                              <div className="w-9 h-9 bg-gray-100 rounded-lg animate-pulse" />
                              <div className="w-48 h-4 bg-gray-100 rounded animate-pulse" />
                            </td>
                            <td className="p-4"><div className="w-8 h-4 bg-gray-100 rounded animate-pulse ml-auto" /></td>
                            <td className="p-4 pr-6"><div className="w-16 h-4 bg-gray-100 rounded animate-pulse ml-auto" /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TAB 2: PRODUCT FUNNEL ─── */}
          {activeTab === 'funnel' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Funnel Overview Banner */}
              {funnelData && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      label: 'Total Views', value: (funnelData.overall.totalViews || 0).toLocaleString('en-IN'),
                      icon: Eye, bg: 'bg-indigo-50', fg: 'text-indigo-600', desc: 'Product page visits'
                    },
                    {
                      label: 'Added to Cart', value: (funnelData.overall.totalCarts || 0).toLocaleString('en-IN'),
                      icon: ShoppingCart, bg: 'bg-violet-50', fg: 'text-violet-600',
                      desc: funnelData.overall.totalViews > 0
                        ? `${((funnelData.overall.totalCarts / funnelData.overall.totalViews) * 100).toFixed(1)}% of views`
                        : 'No views yet'
                    },
                    {
                      label: 'Purchased', value: (funnelData.overall.totalPurchases || 0).toLocaleString('en-IN'),
                      icon: CreditCard, bg: 'bg-pink-50', fg: 'text-pink-600',
                      desc: funnelData.overall.totalCarts > 0
                        ? `${((funnelData.overall.totalPurchases / funnelData.overall.totalCarts) * 100).toFixed(1)}% of cart adds`
                        : 'No cart adds yet'
                    },
                  ].map(({ label, value, icon: Icon, bg, fg, desc }) => (
                    <div key={label} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <div className={`w-12 h-12 rounded-xl ${bg} ${fg} flex items-center justify-center mb-4`}>
                        <Icon size={24} />
                      </div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                      <h3 className="text-3xl font-black text-gray-800">{value}</h3>
                      <p className="text-xs text-gray-400 mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Info box about how tracking works */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-indigo-800 text-sm">
                <Eye className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold mb-1">How product funnel tracking works:</p>
                  <p className="text-indigo-700">
                    <strong>Views</strong> are recorded every time any visitor (including guests) opens a product page.
                    <strong className="ml-1">Cart adds</strong> are recorded when logged-in users add items.
                    <strong className="ml-1">Purchases</strong> come from completed orders.
                    Data updates every 15 minutes via the ETL pipeline.
                  </p>
                </div>
              </div>

              {/* Per-product funnel table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <MousePointerClick className="text-dark-red" size={18} /> Per-Product Conversion Funnel
                  </h4>
                </div>
                {!funnelData || funnelData.products.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Eye size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-400">No funnel data yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Views will appear here after the next ETL run (every 15 min).</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                          <th className="p-4 pl-6">Product</th>
                          <th className="p-4 text-center">
                            <span className="flex items-center gap-1 justify-center text-indigo-400"><Eye size={12} /> Views</span>
                          </th>
                          <th className="p-4 text-center">
                            <span className="flex items-center gap-1 justify-center text-violet-400"><ShoppingCart size={12} /> Cart Adds</span>
                          </th>
                          <th className="p-4 text-center">
                            <span className="flex items-center gap-1 justify-center text-pink-400"><CreditCard size={12} /> Purchases</span>
                          </th>
                          <th className="p-4 text-center">View→Cart</th>
                          <th className="p-4 text-center">Cart→Buy</th>
                          <th className="p-4 text-right pr-6">Overall Conv.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {funnelData.products.map((item: any) => (
                          <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                {item.images?.[0] ? (
                                  <img src={item.images[0]} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-100" />
                                )}
                                <p className="font-semibold text-gray-800 text-sm max-w-[200px] truncate">{item.name}</p>
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-indigo-600">{(item.totalViews || 0).toLocaleString()}</td>
                            <td className="p-4 text-center font-bold text-violet-600">{(item.totalCarts || 0).toLocaleString()}</td>
                            <td className="p-4 text-center font-bold text-pink-600">{(item.totalPurchases || 0).toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${item.viewToCartRate > 30 ? 'bg-green-50 text-green-600' : item.viewToCartRate > 10 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}`}>
                                {item.viewToCartRate}%
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${item.cartToPurchaseRate > 50 ? 'bg-green-50 text-green-600' : item.cartToPurchaseRate > 25 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}`}>
                                {item.cartToPurchaseRate}%
                              </span>
                            </td>
                            <td className="p-4 text-right pr-6">
                              <span className={`font-black text-lg ${item.viewToPurchaseRate > 10 ? 'text-green-600' : item.viewToPurchaseRate > 3 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                {item.viewToPurchaseRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── TAB 3: COHORTS ─── */}
          {activeTab === 'cohorts' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                <Calendar className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold mb-1">How to read this chart:</p>
                  <p className="text-blue-700">Month 0 is when customers made their first purchase. Month 1+ shows how many returned to buy again. Higher % = better retention.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto p-6">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs border-b border-gray-100 min-w-[120px]">Cohort</th>
                        <th className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs border-b border-gray-100 min-w-[80px]">Users</th>
                        {[...Array(6)].map((_, i) => (
                          <th key={i} className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs text-center border-b border-gray-100 min-w-[80px]">
                            M{i}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cohortData.map((cohort, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-bold text-gray-800">{cohort.cohort}</td>
                          <td className="p-3 font-medium text-gray-500 flex items-center gap-1">
                            <Users size={12} /> {cohort.total_users}
                          </td>
                          {[...Array(6)].map((_, i) => {
                            const monthData = cohort.months[i];
                            if (!monthData) return <td key={i} className="p-3 bg-gray-50/30" />;
                            const pct = monthData.retention_percent;
                            const isM0 = i === 0;
                            return (
                              <td key={i} className="p-1 text-center">
                                <div
                                  className={`w-full h-full p-2 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-105 cursor-default ${isM0 ? 'bg-dark-red/10 text-dark-red' : ''}`}
                                  style={!isM0 && pct > 0 ? {
                                    backgroundColor: `rgba(139, 0, 0, ${Math.max(0.05, pct / 40)})`,
                                    color: pct > 20 ? 'white' : 'black'
                                  } : {}}
                                >
                                  <span className="font-bold">{pct.toFixed(0)}%</span>
                                  {!isM0 && pct > 0 && <span className="text-[10px] opacity-70">₹{monthData.revenue}</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {cohortData.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-gray-500">No cohort data available yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TAB: BEHAVIORAL ─── */}
          {activeTab === 'behavioral' && behavioralData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <ActivitySquare className="text-dark-red" size={20} /> Peak Order Times
                  </h4>
                  <div className="space-y-4">
                    {behavioralData.peakOrders.map((peak: any, idx: number) => {
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const dayName = days[peak._id.dayOfWeek - 1];
                      const hourStr = peak._id.hour === 0 ? '12 AM' : peak._id.hour < 12 ? `${peak._id.hour} AM` : peak._id.hour === 12 ? '12 PM' : `${peak._id.hour - 12} PM`;
                      return (
                        <div key={idx} className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div>
                            <p className="font-bold text-gray-800">{dayName}, {hourStr}</p>
                          </div>
                          <div className="bg-dark-red/10 text-dark-red px-3 py-1 rounded-lg font-bold">
                            {peak.orders} orders
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={20} /> Error Rates
                  </h4>
                  <div className="space-y-4">
                    {behavioralData.errorRates.length === 0 ? (
                      <p className="text-gray-500">No recent errors detected.</p>
                    ) : (
                      behavioralData.errorRates.map((err: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100">
                          <div>
                            <p className="font-bold text-red-800">{err._id}</p>
                          </div>
                          <div className="bg-red-500 text-white px-3 py-1 rounded-lg font-bold">
                            {err.count} instances
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TAB: INTELLIGENCE ─── */}
          {activeTab === 'intelligence' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-indigo-50/30">
                  <BrainCircuit className="text-indigo-600" size={18} />
                  <h4 className="font-bold text-gray-800">Advanced Product Intelligence</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-4 font-semibold">Product</th>
                        <th className="px-5 py-4 text-center font-semibold">Repeat Buy Rate</th>
                        <th className="px-5 py-4 font-semibold">Frequently Bought Together</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {intelligenceData.map((item: any) => (
                        <tr key={item.product_id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-gray-800">{item.product_name}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${item.repeat_purchase_rate > 20 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {item.repeat_purchase_rate}%
                            </span>
                            <div className="text-[10px] text-gray-400 mt-1">of {item.total_unique_buyers} buyers</div>
                          </td>
                          <td className="px-5 py-4">
                            {item.frequently_bought_together.length > 0 ? (
                              <div className="space-y-2">
                                {item.frequently_bought_together.map((pair: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md">+{pair.co_occurrences}</span>
                                    <span className="text-gray-600 truncate max-w-[200px]">{pair.paired_product_name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No strong pairings</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {intelligenceData.length === 0 && (
                        <tr><td colSpan={3} className="p-8 text-center text-gray-500">No intelligence data generated yet. Run ETL to populate.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TAB: AT RISK ─── */}
          {activeTab === 'at-risk' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={exportAtRiskToCSV}
                  className="flex items-center gap-2 bg-dark-red text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-red-800 transition-colors"
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-red-50/30">
                  <AlertOctagon className="text-red-600" size={18} />
                  <h4 className="font-bold text-gray-800">Customers at Risk of Churn</h4>
                  <span className="text-xs text-gray-500 font-medium">(Exceeded product lifespan)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-4 font-semibold">Customer</th>
                        <th className="px-5 py-4 font-semibold">Contact</th>
                        <th className="px-5 py-4 font-semibold">Last Order Date</th>
                        <th className="px-5 py-4 text-center font-semibold">Days Since Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {atRiskData.map((user: any) => (
                        <tr key={user._id} className="hover:bg-red-50/30 transition-colors">
                          <td className="px-5 py-4 font-semibold text-gray-800">{user.name || 'Anonymous'}</td>
                          <td className="px-5 py-4 text-gray-600">
                            <div>{user.email}</div>
                            <div className="text-xs text-gray-400">{user.phone}</div>
                          </td>
                          <td className="px-5 py-4 text-gray-600">{new Date(user.lastOrderDate).toLocaleDateString()}</td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              {Math.floor(user.daysSinceLastOrder)} days
                            </span>
                            <div className="text-[10px] text-gray-400 mt-1">Lifespan: {user.maxLifespanDays}d</div>
                          </td>
                        </tr>
                      ))}
                      {atRiskData.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">✅ All customers are within their expected buying cycles.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

{/* ─── TAB: LIVE VIEW ─── */}
{activeTab === 'live' && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Active Visitors</p>
        <h3 className="text-5xl font-black text-gray-800 flex items-center gap-3">
          {liveData.activeVisitors}
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </h3>
      </div>
      <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
        <Activity size={32} />
      </div>
    </div>
    
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 font-bold text-gray-800">
        Live Event Stream
      </div>
      <div className="p-0 overflow-y-auto max-h-[500px]">
        {liveData.events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Waiting for live events...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {liveData.events.map((ev, i) => (
              <div key={i} className="p-4 hover:bg-gray-50/50 flex items-start gap-4">
                <div className="bg-gray-100 p-2 rounded-lg text-gray-500 mt-1">
                  <Activity size={16} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 capitalize">{ev.type.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-gray-500">{new Date(ev.timestamp).toLocaleTimeString()}</div>
                  <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded text-gray-600 overflow-x-auto">
                    {JSON.stringify(ev.metadata)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </motion.div>
)}

{/* ─── TAB: MARKETING ─── */}
{activeTab === 'marketing' && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3 font-bold text-gray-800">
        <TrendingUp size={18} className="text-purple-600" /> Marketing Attribution (Last Non-Direct Click)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-5 py-4 font-semibold">Source / Medium</th>
              <th className="px-5 py-4 font-semibold text-right">Orders</th>
              <th className="px-5 py-4 font-semibold text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {marketingData.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-bold text-gray-800 capitalize">{row.source}</div>
                  <div className="text-xs text-gray-400">{row.medium}</div>
                </td>
                <td className="px-5 py-4 text-right font-medium text-gray-600">{row.totalOrders}</td>
                <td className="px-5 py-4 text-right font-bold text-green-600">{fmt(row.totalRevenue)}</td>
              </tr>
            ))}
            {marketingData.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-gray-500">No marketing data found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </motion.div>
)}

{/* ─── TAB: SEARCH ─── */}
{activeTab === 'search' && searchData && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 font-bold text-gray-800">Top Searches</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Query</th>
              <th className="px-5 py-3 text-right">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {searchData.topSearches.map((row: any, i: number) => (
              <tr key={i}>
                <td className="px-5 py-3 text-gray-800">{row.query}</td>
                <td className="px-5 py-3 text-right text-gray-500">{row.count}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-red-50/50 font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" /> Zero-Result Searches
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Query</th>
              <th className="px-5 py-3 text-right">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {searchData.zeroResultSearches.map((row: any, i: number) => (
              <tr key={i}>
                <td className="px-5 py-3 text-gray-800 font-medium">{row.query}</td>
                <td className="px-5 py-3 text-right text-red-500 font-bold">{row.count}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  </motion.div>
)}

{/* ─── TAB: STOCK ALERTS (INVENTORY HEALTH) ─── */}
{activeTab === 'stock' && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
        <Package className="text-gray-600" size={18} />
        <h4 className="font-bold text-gray-800">Inventory Forecast & ABC Analysis</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-4 font-semibold">Product</th>
              <th className="px-5 py-4 font-semibold text-center">Grade</th>
              <th className="px-5 py-4 font-semibold text-right">Current Stock</th>
              <th className="px-5 py-4 font-semibold text-right">Daily Velocity</th>
              <th className="px-5 py-4 font-semibold text-right">Days Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {inventoryForecast.map((p: any) => (
              <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-800">{p.name}</td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-black ${
                    p.grade === 'A' ? 'bg-green-100 text-green-700' :
                    p.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.grade}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-medium">{p.stock}</td>
                <td className="px-5 py-4 text-right text-gray-500">{p.dailyVelocity} / day</td>
                <td className="px-5 py-4 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-bold ${p.daysRemaining < 14 ? 'text-red-500' : 'text-gray-800'}`}>
                      {p.daysRemaining === 999 ? '∞' : `${p.daysRemaining} days`}
                    </span>
                    {p.dataConfidence === 'low' && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                        LOW CONFIDENCE
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </motion.div>
)}

        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
