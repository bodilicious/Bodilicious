import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Users, ShoppingCart, IndianRupee,
  Activity, Package, RefreshCw, TrendingDown,
  Bell, Eye, MousePointerClick, CreditCard, AlertTriangle,
  BarChart3, Download, BrainCircuit, AlertOctagon,
  Truck, Sparkles, ChevronRight
} from 'lucide-react';
import Papa from 'papaparse';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Select from '../components/Select';
import { useSearchParams } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

// Modular section components
import SalesSection from './analytics/SalesSection';
import ProductHealthSection from './analytics/ProductHealthSection';
import CustomerCRMSection from './analytics/CustomerCRMSection';
import OperationsSection from './analytics/OperationsSection';
import BehavioralSection from './analytics/BehavioralSection';
import DateRangePicker from './analytics/DateRangePicker';

type Section =
  | 'sales'
  | 'products'
  | 'customers'
  | 'operations'
  | 'behavioral'
  | 'intelligence';

type IntelSubTab = 'overview' | 'funnel' | 'cohorts' | 'at-risk' | 'marketing' | 'search' | 'stock';

const NAV_SECTIONS: { key: Section; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'sales',         label: 'Sales & Revenue',        sub: 'Revenue trend, payment mix, AOV', icon: <IndianRupee size={17} /> },
  { key: 'products',      label: 'Products & Categories',  sub: 'Top sellers, returns, category share', icon: <Package size={17} /> },
  { key: 'customers',     label: 'Customers & Segments',   sub: 'New vs returning, CLV, retention', icon: <Users size={17} /> },
  { key: 'operations',    label: 'Operations',             sub: 'Fulfillment time, SLA', icon: <Truck size={17} /> },
  { key: 'behavioral',    label: 'Behavioral Insights',    sub: 'Peak times heatmap, error rates', icon: <Activity size={17} /> },
  { key: 'intelligence',  label: 'Deep Intelligence',      sub: 'Funnel, cohorts, at-risk, forecasts', icon: <BrainCircuit size={17} /> },
];

const fmt = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const AnalyticsPage: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = (searchParams.get('section') as Section) || 'sales';

  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [intelTab, setIntelTab] = useState<IntelSubTab>('overview');
  const [isSideNavOpen, setIsSideNavOpen] = useState(false); // for mobile

  const [timeRange, setTimeRange] = useState('30');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 30 Days'
  });

  // === ADMIN analytics (chart-heavy)
  const [salesData, setSalesData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [operationData, setOperationData] = useState<any>(null);
  const [behavioralData, setBehavioralData] = useState<any>(null);

  // === DEEP analytics (ETL-backed)
  const [summaryData, setSummaryData] = useState<any>(null);
  const [trendingData, setTrendingData] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [lowStockData, setLowStockData] = useState<any[]>([]);
  const [atRiskData, setAtRiskData] = useState<any[]>([]);
  const [marketingData, setMarketingData] = useState<any[]>([]);
  const [searchData, setSearchData] = useState<any>(null);
  const [inventoryForecast, setInventoryForecast] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchData = useCallback(async (isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      else setIsRefreshing(true);
      const headers = await getAuthHeaders();
      const qp = `startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;

      const [
        salesRes, prodRes, invRes, custRes, opsRes, behRes,
        summaryRes, trendRes, cohortRes, funnelRes, stockRes,
        intellRes, atRiskRes, mktRes, searchRes, forecastRes
      ] = await Promise.allSettled([
        // Admin (chart-heavy)
        fetch(`${API_URL}/api/v1/admin/analytics/sales?${qp}`,         { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/products?${qp}`,      { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/inventory`,            { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/customers?${qp}`,     { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/operations?${qp}`,    { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/behavioral?${qp}`,    { headers }),
        // Deep ETL analytics
        fetch(`${API_URL}/api/v1/admin/analytics/executive-summary?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/trending-products?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/cohorts`,                             { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/product-funnel?days=${timeRange}`,    { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/low-stock`,                           { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/product-intelligence`,                { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/customers-at-risk`,                   { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/marketing`,                           { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/search-stats`,                        { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/inventory-forecast`,                  { headers }),
      ]);

      const safeJson = async (res: PromiseSettledResult<Response>) => {
        if (res && res.status === 'fulfilled' && res.value.ok) {
          try { return await res.value.json(); } catch { return null; }
        }
        return null;
      };

      const [
        sData, pData, invData, cData, oData, bData,
        sumData, trData, coData, fuData, stData,
        intellData, arData, mkData, seData, foData
      ] = await Promise.all([
        safeJson(salesRes), safeJson(prodRes), safeJson(invRes), safeJson(custRes),
        safeJson(opsRes), safeJson(behRes),
        safeJson(summaryRes), safeJson(trendRes), safeJson(cohortRes), safeJson(funnelRes),
        safeJson(stockRes), safeJson(intellRes), safeJson(atRiskRes),
        safeJson(mktRes), safeJson(searchRes), safeJson(forecastRes),
      ]);

      if (sData?.success)   setSalesData(sData.data);
      if (pData?.success)   setProductData(pData.data);
      if (cData?.success)   setCustomerData(cData.data);
      if (oData?.success)   setOperationData(oData.data);
      if (bData?.success)   setBehavioralData(bData.data);
      if (sumData?.success) setSummaryData(sumData.data);
      if (trData?.success)  setTrendingData(trData.data);
      if (coData?.success)  setCohortData(coData.data);
      if (fuData?.success)  setFunnelData(fuData.data);
      if (stData?.success)  setLowStockData(stData.data);
      if (arData?.success)  setAtRiskData(arData.data);
      if (mkData?.success)  setMarketingData(mkData.data);
      if (seData?.success)  setSearchData(seData.data);
      if (foData?.success)  setInventoryForecast(foData.data);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load some analytics data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [getAuthHeaders, API_URL, dateRange, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync URL param when section changes
  const handleSectionChange = (key: Section) => {
    setActiveSection(key);
    setSearchParams({ section: key });
    setIsSideNavOpen(false);
  };

  const exportAtRiskToCSV = () => {
    if (!atRiskData?.length) return;
    const csv = Papa.unparse(atRiskData.map(c => ({
      'Name': c.name, 'Email': c.email, 'Phone': c.phone || 'N/A',
      'Last Order Date': new Date(c.lastOrderDate).toLocaleDateString(),
      'Days Since Last Order': Math.floor(c.daysSinceLastOrder),
      'Expected Product Lifespan': c.maxLifespanDays
    })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', `at_risk_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const INTEL_SUBTABS: { key: IntelSubTab; label: string }[] = [
    { key: 'overview',  label: 'Revenue Overview' },
    { key: 'funnel',    label: 'Product Funnel' },
    { key: 'cohorts',   label: 'Retention Cohorts' },
    { key: 'at-risk',   label: 'At-Risk Customers' },
    { key: 'marketing', label: 'Marketing Attribution' },
    { key: 'search',    label: 'Storefront Search' },
    { key: 'stock',     label: 'Inventory Forecast' },
  ];

  return (
    <div className="flex min-h-full gap-0 -m-3 sm:-m-6 lg:-m-8">

      {/* === LEFT NAV === */}
      {/* Mobile overlay */}
      {isSideNavOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setIsSideNavOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-30 bg-[#FAFAF9] border-r border-gray-100 transition-transform duration-300
        lg:static lg:translate-x-0 lg:h-auto lg:z-auto
        w-72 flex-shrink-0 flex flex-col
        ${isSideNavOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Nav header */}
        <div className="p-5 border-b border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Analytics</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_SECTIONS.map(sec => (
            <button
              key={sec.key}
              onClick={() => handleSectionChange(sec.key)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer group ${
                activeSection === sec.key
                  ? 'bg-dark-red text-white shadow-md'
                  : 'text-gray-600 hover:bg-[#F5F2EC] hover:text-dark-red'
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${activeSection === sec.key ? 'text-white' : 'text-gray-400 group-hover:text-dark-red'}`}>
                {sec.icon}
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">{sec.label}</p>
                <p className={`text-[11px] mt-0.5 leading-tight ${activeSection === sec.key ? 'text-white/70' : 'text-gray-400'}`}>
                  {sec.sub}
                </p>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* === MAIN CONTENT === */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Sticky top toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsSideNavOpen(true)}
            className="lg:hidden p-2 text-dark-red rounded-lg hover:bg-[#F5F2EC] transition-colors cursor-pointer"
          >
            <BarChart3 size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-gray-400 hidden sm:block">Analytics</span>
            <ChevronRight size={14} className="text-gray-300 hidden sm:block" />
            <span className="font-bold text-dark-red">
              {NAV_SECTIONS.find(s => s.key === activeSection)?.label}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {activeSection === 'intelligence' ? (
              <Select
                className="w-36"
                value={timeRange}
                onChange={(val) => setTimeRange(val as string)}
                options={[
                  { value: '7',   label: 'Last 7 Days' },
                  { value: '30',  label: 'Last 30 Days' },
                  { value: '90',  label: 'Last 90 Days' },
                  { value: '365', label: 'Last Year' },
                ]}
              />
            ) : (
              <DateRangePicker onRangeChange={setDateRange} currentRange={dateRange} />
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-2 bg-[#F5F2EC] text-dark-red hover:bg-ruby-red hover:text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Grade A stockout banner */}
        {inventoryForecast.some((p: any) => p.grade === 'A' && p.daysRemaining < 14) && (
          <div className="mx-4 sm:mx-6 mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-red-800 font-bold text-sm">Critical: Grade A Stockout Risk</h4>
              <ul className="list-disc list-outside pl-4 mt-1 text-xs text-red-700 space-y-0.5">
                {inventoryForecast.filter((p: any) => p.grade === 'A' && p.daysRemaining < 14).map((p: any) => (
                  <li key={p._id}><span className="font-semibold">{p.name}</span> — {p.daysRemaining} days left</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Section content */}
        <div className="p-4 sm:p-6 flex-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-dark-red border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Loading analytics...</p>
            </div>
          ) : (
            <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

              {/* ── SALES ── */}
              {activeSection === 'sales' && (
                <SalesSection
                  salesTrend={salesData?.salesTrend || []}
                  paymentSplit={salesData?.paymentSplit || []}
                />
              )}

              {/* ── PRODUCTS ── */}
              {activeSection === 'products' && (
                <ProductHealthSection
                  topSelling={productData?.topSelling || []}
                  categoryRevenue={productData?.categoryRevenue || []}
                  returnRates={productData?.returnRates || []}
                />
              )}

              {/* ── CUSTOMERS ── */}
              {activeSection === 'customers' && (
                <CustomerCRMSection
                  segmentStats={customerData?.segmentStats || []}
                  funnelData={customerData?.funnelData || []}
                  trendData={customerData?.trendData || []}
                />
              )}

              {/* ── OPERATIONS ── */}
              {activeSection === 'operations' && (
                <OperationsSection
                  avgFulfillmentDays={operationData?.avgFulfillmentDays || 0}
                  slaBreakdown={operationData?.slaBreakdown || {}}
                  totalDelivered={operationData?.totalDelivered || 0}
                />
              )}

              {/* ── BEHAVIORAL ── */}
              {activeSection === 'behavioral' && (
                <BehavioralSection
                  peakOrders={behavioralData?.peakOrders || []}
                  backendErrors={behavioralData?.backendErrors || []}
                  checkoutFailures={behavioralData?.checkoutFailures || []}
                  checkoutFailureTotal={behavioralData?.checkoutFailureTotal || 0}
                  checkoutRevenueLost={behavioralData?.checkoutRevenueLost || 0}
                  errorRates={behavioralData?.errorRates}
                />
              )}


              {/* ── DEEP INTELLIGENCE ── */}
              {activeSection === 'intelligence' && (
                <div className="space-y-6">
                  {/* Sub-tab strip */}
                  <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                    {INTEL_SUBTABS.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setIntelTab(t.key)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-grow sm:flex-grow-0 whitespace-nowrap ${
                          intelTab === t.key
                            ? 'bg-dark-red text-white shadow-md'
                            : 'bg-gray-50 text-gray-500 hover:text-dark-red hover:bg-[#F5F2EC]'
                        }`}
                      >
                        {t.label}
                        {t.key === 'stock' && lowStockData.length > 0 && (
                          <span className="ml-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            {lowStockData.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* ── Intel: Revenue Overview ── */}
                  {intelTab === 'overview' && summaryData && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {[
                          { label: 'Net Revenue', value: fmt(summaryData.summary.netRevenue), icon: IndianRupee, bg: 'bg-green-50', fg: 'text-green-600' },
                          { label: 'Total Orders', value: summaryData.summary.orders, icon: ShoppingCart, bg: 'bg-blue-50', fg: 'text-blue-600' },
                          { label: 'Avg Order Value', value: fmt(summaryData.summary.averageOrderValue), icon: TrendingUp, bg: 'bg-purple-50', fg: 'text-purple-600' },
                        ].map(({ label, value, icon: Icon, bg, fg }) => (
                          <div key={label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                              <div className={`w-9 h-9 rounded-xl ${bg} ${fg} flex items-center justify-center`}><Icon size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-gray-800">{value}</h3>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-6">Revenue Trend (Net)</h4>
                        <div className="h-72">
                          {summaryData.chartData?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={summaryData.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colNet" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3D0A05" stopOpacity={0.12} />
                                    <stop offset="95%" stopColor="#3D0A05" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date_string" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }}
                                  tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`; }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }}
                                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                  formatter={(v: any) => fmt(Number(v))} />
                                <Area type="monotone" dataKey="net_revenue" name="Net Revenue" stroke="#3D0A05" strokeWidth={3} fillOpacity={1} fill="url(#colNet)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                              <TrendingDown size={32} />
                              <p className="text-sm font-medium text-gray-400">No revenue data for this period</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Top trending products table */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                          <Package className="text-dark-red" size={18} />
                          <h4 className="font-bold text-gray-800">Top Trending Products</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="p-4 pl-6">Rank</th><th className="p-4">Product</th>
                                <th className="p-4 text-right">Units</th><th className="p-4 text-right pr-6">Revenue</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {trendingData.slice(0, 8).map((item, i) => (
                                <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-4 pl-6 text-sm font-bold text-gray-400">#{i + 1}</td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      {item.images?.[0] ? <img src={item.images[0]} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-gray-100" /> : <div className="w-9 h-9 rounded-lg bg-gray-100" />}
                                      <p className="font-bold text-gray-800 text-sm max-w-[240px] truncate">{item.name}</p>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right font-medium text-gray-800">{item.totalPurchases}</td>
                                  <td className="p-4 text-right pr-6 font-bold text-dark-red">{fmt(item.totalRevenue)}</td>
                                </tr>
                              ))}
                              {trendingData.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No data yet</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Intel: Product Funnel ── */}
                  {intelTab === 'funnel' && (
                    <div className="space-y-6">
                      {funnelData && (
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: 'Total Views', value: (funnelData.overall.totalViews || 0).toLocaleString('en-IN'), icon: Eye, bg: 'bg-indigo-50', fg: 'text-indigo-600' },
                            { label: 'Added to Cart', value: (funnelData.overall.totalCarts || 0).toLocaleString('en-IN'), icon: ShoppingCart, bg: 'bg-violet-50', fg: 'text-violet-600' },
                            { label: 'Purchased', value: (funnelData.overall.totalPurchases || 0).toLocaleString('en-IN'), icon: CreditCard, bg: 'bg-pink-50', fg: 'text-pink-600' },
                          ].map(({ label, value, icon: Icon, bg, fg }) => (
                            <div key={label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                              <div className={`w-10 h-10 rounded-xl ${bg} ${fg} flex items-center justify-center mb-3`}><Icon size={20} /></div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                              <h3 className="text-3xl font-black text-gray-800">{value}</h3>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-indigo-800 text-sm">
                        <Eye className="shrink-0 mt-0.5" size={16} />
                        <p>Views are recorded per product page visit. Cart adds require login. Purchases come from completed orders. Data updates every 15 min via ETL.</p>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                          <MousePointerClick className="text-dark-red" size={18} />
                          <h4 className="font-bold text-gray-800">Per-Product Conversion Funnel</h4>
                        </div>
                        {!funnelData || funnelData.products.length === 0 ? (
                          <div className="p-12 text-center text-gray-400"><Eye size={28} className="mx-auto mb-3 text-gray-200" /><p>No funnel data yet.</p></div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead><tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="p-4 pl-6">Product</th>
                                <th className="p-4 text-center">Views</th><th className="p-4 text-center">Carts</th>
                                <th className="p-4 text-center">Buys</th><th className="p-4 text-center">View→Cart</th>
                                <th className="p-4 text-center">Cart→Buy</th><th className="p-4 text-right pr-6">Overall</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {funnelData.products.map((item: any) => (
                                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 pl-6">
                                      <div className="flex items-center gap-3">
                                        {item.images?.[0] ? <img src={item.images[0]} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-gray-100" /> : <div className="w-8 h-8 rounded-lg bg-gray-100" />}
                                        <p className="font-semibold text-gray-800 text-sm max-w-[180px] truncate">{item.name}</p>
                                      </div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-indigo-600">{item.totalViews || 0}</td>
                                    <td className="p-4 text-center font-bold text-violet-600">{item.totalCarts || 0}</td>
                                    <td className="p-4 text-center font-bold text-pink-600">{item.totalPurchases || 0}</td>
                                    <td className="p-4 text-center">
                                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${item.viewToCartRate > 30 ? 'bg-green-50 text-green-600' : item.viewToCartRate > 10 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}`}>
                                        {item.viewToCartRate}%
                                      </span>
                                    </td>
                                    <td className="p-4 text-center">
                                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${item.cartToPurchaseRate > 50 ? 'bg-green-50 text-green-600' : item.cartToPurchaseRate > 25 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'}`}>
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
                    </div>
                  )}

                  {/* ── Intel: Retention Cohorts ── */}
                  {intelTab === 'cohorts' && (
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                        <Bell className="shrink-0 mt-0.5" size={16} />
                        <p>Month 0 = first purchase. Month 1+ = how many returned. Higher % = better retention.</p>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto p-6">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead><tr>
                              <th className="p-3 font-bold text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 min-w-[120px]">Cohort</th>
                              <th className="p-3 font-bold text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 min-w-[70px]">Users</th>
                              {[...Array(6)].map((_, i) => <th key={i} className="p-3 font-bold text-gray-400 text-xs text-center border-b border-gray-100 min-w-[72px]">M{i}</th>)}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                              {cohortData.map((cohort, idx) => (
                                <tr key={idx}>
                                  <td className="p-3 font-bold text-gray-800">{cohort.cohort}</td>
                                  <td className="p-3 font-medium text-gray-500">{cohort.total_users}</td>
                                  {[...Array(6)].map((_, i) => {
                                    const m = cohort.months[i];
                                    if (!m) return <td key={i} className="p-3 bg-gray-50/30" />;
                                    const pct = m.retention_percent;
                                    return (
                                      <td key={i} className="p-1 text-center">
                                        <div className="p-2 rounded-xl flex flex-col items-center"
                                          style={i > 0 && pct > 0 ? { backgroundColor: `rgba(61,10,5,${Math.max(0.06, pct / 40)})`, color: pct > 20 ? 'white' : '#111' } : { background: '#FEF2F2', color: '#3D0A05' }}>
                                          <span className="font-bold text-xs">{pct.toFixed(0)}%</span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {cohortData.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-gray-400">No cohort data yet.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Intel: At-Risk Customers ── */}
                  {intelTab === 'at-risk' && (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <button onClick={exportAtRiskToCSV} className="flex items-center gap-2 bg-dark-red text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-red-900 transition-colors cursor-pointer">
                          <Download size={15} /> Export CSV
                        </button>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-red-50/40">
                          <AlertOctagon className="text-red-600" size={18} />
                          <h4 className="font-bold text-gray-800">Customers at Risk of Churn</h4>
                          <span className="text-xs text-gray-400">(Exceeded product lifespan)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead><tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                              <th className="px-5 py-4">Customer</th><th className="px-5 py-4">Contact</th>
                              <th className="px-5 py-4">Last Order</th><th className="px-5 py-4 text-center">Days Since</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                              {atRiskData.map((u: any) => (
                                <tr key={u._id} className="hover:bg-red-50/20 transition-colors">
                                  <td className="px-5 py-4 font-semibold text-gray-800">{u.name || 'Anonymous'}</td>
                                  <td className="px-5 py-4"><div>{u.email}</div><div className="text-xs text-gray-400">{u.phone}</div></td>
                                  <td className="px-5 py-4 text-gray-600">{new Date(u.lastOrderDate).toLocaleDateString()}</td>
                                  <td className="px-5 py-4 text-center">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{Math.floor(u.daysSinceLastOrder)} days</span>
                                  </td>
                                </tr>
                              ))}
                              {atRiskData.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-400">All customers within their buying cycles ✓</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Intel: Marketing Attribution ── */}
                  {intelTab === 'marketing' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50 font-bold text-gray-800">
                        <TrendingUp size={18} className="text-purple-600" /> Marketing Attribution
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-400 uppercase tracking-wider text-xs">
                            <tr><th className="px-5 py-4">Source / Medium</th><th className="px-5 py-4 text-right">Orders</th><th className="px-5 py-4 text-right">Revenue</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {marketingData.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-4"><div className="font-bold text-gray-800 capitalize">{row.source}</div><div className="text-xs text-gray-400">{row.medium}</div></td>
                                <td className="px-5 py-4 text-right font-medium text-gray-600">{row.totalOrders}</td>
                                <td className="px-5 py-4 text-right font-bold text-green-600">{fmt(row.totalRevenue)}</td>
                              </tr>
                            ))}
                            {marketingData.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-gray-400">No marketing data found.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Intel: Storefront Search ── */}
                  {intelTab === 'search' && searchData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { title: 'Top Searches', data: searchData.topSearches, accent: 'text-indigo-600', bg: '' },
                        { title: 'Zero-Result Searches', data: searchData.zeroResultSearches, accent: 'text-red-600', bg: 'bg-red-50/30' },
                      ].map(panel => (
                        <div key={panel.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <div className={`p-5 border-b border-gray-100 font-bold text-gray-800 text-sm ${panel.bg}`}>
                            {panel.title}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                                <tr><th className="px-5 py-3">Query</th><th className="px-5 py-3 text-right">Count</th></tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {panel.data.map((row: any, i: number) => (
                                  <tr key={i}><td className="px-5 py-3 text-gray-800">{row.query}</td><td className={`px-5 py-3 text-right font-bold ${panel.accent}`}>{row.count}</td></tr>
                                ))}
                                {panel.data.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-gray-400">No data</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Intel: Inventory Forecast ── */}
                  {intelTab === 'stock' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                          <Package className="text-gray-500" size={18} />
                          <h4 className="font-bold text-gray-800">Inventory Forecast & ABC Analysis</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-4">Product</th><th className="px-5 py-4 text-center">Grade</th>
                                <th className="px-5 py-4 text-right">Stock</th><th className="px-5 py-4 text-right">Daily Vel.</th>
                                <th className="px-5 py-4 text-right">Days Left</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {inventoryForecast.map((p: any) => (
                                <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-5 py-4 font-medium text-gray-800">{p.name}</td>
                                  <td className="px-5 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${p.grade === 'A' ? 'bg-green-100 text-green-700' : p.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                      {p.grade}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-right font-medium">{p.stock}</td>
                                  <td className="px-5 py-4 text-right text-gray-500">{p.dailyVelocity}/d</td>
                                  <td className="px-5 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                      <span className={`font-bold ${p.daysRemaining < 14 ? 'text-red-500' : 'text-gray-800'}`}>
                                        {p.daysRemaining === 999 ? '∞' : `${p.daysRemaining}d`}
                                      </span>
                                      {p.dataConfidence === 'low' && (
                                        <span className="text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">LOW CONF.</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {inventoryForecast.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-gray-400">No forecast data yet.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Low stock quick list */}
                      {lowStockData.length > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                          <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Currently Low / Out of Stock</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {lowStockData.map((p: any) => (
                              <div key={p._id} className="flex items-center justify-between bg-white/80 p-3 rounded-xl border border-amber-100">
                                <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
