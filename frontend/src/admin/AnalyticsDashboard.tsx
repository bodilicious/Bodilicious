import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  RefreshCw,
  Tag,
  BarChart2,
  Users,
  Truck,
  Sparkles,
  ChevronDown,
  AlertTriangle, // Added for Inventory Health Alerts
  PackageIcon // Added for Products tab
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';

// New Analytics Components
import DateRangePicker from './analytics/DateRangePicker';
import KPICardsRow from './analytics/KPICardsRow';
import SalesSection from './analytics/SalesSection';
import ProductHealthSection from './analytics/ProductHealthSection';
import CustomerCRMSection from './analytics/CustomerCRMSection';
import OperationsSection from './analytics/OperationsSection';
import RitualAnalyticsSection from './analytics/RitualAnalyticsSection';

const AnalyticsDashboard: React.FC = () => {
  const { getAuthHeaders } = useApp();
  
  // State for all analytics sections
  const [salesData, setSalesData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [operationData, setOperationData] = useState<any>(null);
  const [ritualData, setRitualData] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'customers' | 'operations' | 'ritual'>('sales');
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 30 Days'
  });

  const [refreshError, setRefreshError] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastSyncRef = useRef<Date | null>(null);
  const [sinceSec, setSinceSec] = useState(0);
  const [expiringCoupons, setExpiringCoupons] = useState<Array<{ _id: string; code: string; expiresAt: string }>>([]);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchData = useCallback(async (isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      else setIsRefreshing(true);
      const headers = await getAuthHeaders();
      
      const queryParams = `startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      
      const [salesRes, prodRes, invRes, custRes, opsRes, ritualRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/analytics/sales?${queryParams}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/products?${queryParams}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/inventory`, { headers }), // Global for now
        fetch(`${API_URL}/api/v1/admin/analytics/customers?${queryParams}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/operations?${queryParams}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/ritual-finder?${queryParams}`, { headers }),
      ]);

      if (!salesRes.ok || !prodRes.ok || !invRes.ok || !custRes.ok || !opsRes.ok || !ritualRes.ok) {
        throw new Error("One or more analytics requests failed");
      }

      const [sData, pData, iData, cData, oData, rData] = await Promise.all([
        salesRes.json(), prodRes.json(), invRes.json(), custRes.json(), opsRes.json(), ritualRes.json()
      ]);

      if (sData.success) setSalesData(sData.data);
      if (pData.success) setProductData(pData.data);
      if (iData.success) setInventoryData(iData.data);
      if (cData.success) setCustomerData(cData.data);
      if (oData.success) setOperationData(oData.data);
      if (rData.success) setRitualData(rData.data);

      const now = new Date();
      setLastSync(now);
      lastSyncRef.current = now;
      setSinceSec(0);
      setRefreshError(false);
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setRefreshError(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [getAuthHeaders, API_URL, dateRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch expiring coupons for alerts
  useEffect(() => {
    const loadExpiringCoupons = async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/v1/admin/coupons/expiring`, { headers });
        const d = await r.json();
        if (d.success) setExpiringCoupons(d.data);
      } catch { /* non-critical, fail silently */ }
    };
    loadExpiringCoupons();
  }, [getAuthHeaders, API_URL]);

  // Tick "X seconds ago" every second
  useEffect(() => {
    const t = setInterval(() => {
      if (lastSyncRef.current) {
        setSinceSec(Math.round((Date.now() - lastSyncRef.current.getTime()) / 1000));
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-dark-red border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading comprehensive analytics...</p>
      </div>
    );
  }

  const kpiData = {
    totalRevenue: salesData?.summary?.totalRevenue || 0,
    netRevenue: salesData?.summary?.netRevenue || 0,
    totalOrders: salesData?.summary?.totalOrders || 0,
    aov: salesData?.summary?.aov || 0,
    lostRevenue: inventoryData?.stockoutImpact?.reduce((acc: number, curr: any) => acc + (curr.estimatedDailyLoss * 30), 0) || 0,
    returnRate: productData?.returnRates?.length > 0 ? (productData.returnRates.reduce((acc: number, curr: any) => acc + curr.returnRate, 0) / productData.returnRates.length).toFixed(1) : 0,
    newCustomers: salesData?.summary?.newCustomers || 0
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-dark-red tracking-tight">Analytics Dashboard</h1>
          <div className="flex items-center gap-2 mt-2">
             <span className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400 animate-pulse'}`} />
             <p className="text-xs text-grey-beige font-medium whitespace-nowrap">
               Live Data {lastSync ? `• Synced ${sinceSec < 60 ? `${sinceSec}s` : `${Math.round(sinceSec / 60)}m`} ago` : ''}
             </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={setDateRange} currentRange={dateRange} />
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2.5 bg-silk-light text-grey-beige hover:text-dark-red hover:bg-silk rounded-xl transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center justify-between border border-red-100 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-medium">Partial data sync failed. Retrying in the background...</p>
          <button onClick={() => fetchData()} className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-white rounded-lg shadow-sm">Retry</button>
        </div>
      )}

      {/* Primary KPIs */}
      <KPICardsRow data={kpiData as any} loading={isRefreshing} />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-silk-light/50 border border-silk-light p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'sales' ? 'bg-white text-dark-red shadow-sm border border-silk-light' : 'text-grey-beige hover:text-dark-red'}`}
        >
          <BarChart2 size={18} /> Sales
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-white text-dark-red shadow-sm border border-silk-light' : 'text-grey-beige hover:text-dark-red'}`}
        >
          <PackageIcon size={18} /> Products
        </button>
        <button 
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-white text-dark-red shadow-sm border border-silk-light' : 'text-grey-beige hover:text-dark-red'}`}
        >
          <Users size={18} /> Customers
        </button>
        <button 
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'operations' ? 'bg-white text-dark-red shadow-sm border border-silk-light' : 'text-grey-beige hover:text-dark-red'}`}
        >
          <Truck size={18} /> Operations
        </button>
        <button 
          onClick={() => setActiveTab('ritual')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'ritual' ? 'bg-white text-dark-red shadow-sm border border-silk-light' : 'text-grey-beige hover:text-dark-red'}`}
        >
          <Sparkles size={18} /> Rituals
        </button>
      </div>

      {/* Dashboard Sections */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'sales' && (
          <SalesSection 
            salesTrend={salesData?.salesTrend || []} 
            paymentSplit={salesData?.paymentSplit || []} 
          />
        )}
        {activeTab === 'products' && (
          <ProductHealthSection 
            topSelling={productData?.topSelling || []}
            categoryRevenue={productData?.categoryRevenue || []}
            returnRates={productData?.returnRates || []}
          />
        )}
        {activeTab === 'customers' && (
          <CustomerCRMSection 
            segmentStats={customerData?.segmentStats || []}
            funnelData={customerData?.funnelData || []}
          />
        )}
        {activeTab === 'operations' && (
          <OperationsSection 
            avgFulfillmentDays={operationData?.avgFulfillmentDays || 0}
            slaBreakdown={operationData?.slaBreakdown || {}}
            totalDelivered={operationData?.totalDelivered || 0}
          />
        )}
        {activeTab === 'ritual' && (
          <RitualAnalyticsSection 
            skinTypes={ritualData?.skinTypes || []}
            concerns={ritualData?.concerns || []}
            funnel={ritualData?.funnel || []}
          />
        )}
      </div>

      {/* Operational Alerts (Quick View always at bottom) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="bg-dark-red p-8 rounded-3xl text-white shadow-xl shadow-dark-red/20 relative overflow-hidden">
            <h3 className="text-xl font-serif font-bold mb-6">Inventory Health Alerts</h3>
            <div className="space-y-4">
              {inventoryData?.stockoutImpact?.slice(0, 3).map((item: any) => (
                <div key={item.pid} className="flex items-center justify-between bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                  <div>
                    <p className="text-xs text-red-100 italic">{item.name}</p>
                    <p className="font-bold text-sm">₹{item.estimatedDailyLoss.toLocaleString()} daily loss</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <AlertTriangle size={16} />
                  </div>
                </div>
              ))}
              {(!inventoryData?.stockoutImpact || inventoryData.stockoutImpact.length === 0) && (
                <p className="text-sm text-red-100 opacity-60">All items are currently in stock.</p>
              )}
            </div>
            <Link to="/admin/products" className="block w-full mt-6 py-3 bg-white text-dark-red text-center font-bold rounded-2xl hover:bg-silk-light transition-colors">
               Manage Inventory
            </Link>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-silk shadow-sm shadow-silk-dark/10">
             <h3 className="text-xl font-serif font-bold text-dark-red mb-6 flex items-center gap-2">
                <Tag size={20} className="text-ruby-red" />
                Expiring Coupons
             </h3>
             <div className="space-y-4">
                {expiringCoupons.length > 0 ? expiringCoupons.slice(0, 5).map(c => (
                  <div key={c._id} className="flex items-center justify-between p-4 bg-silk-light/50 rounded-2xl border border-silk-light">
                    <div>
                      <span className="font-mono text-xs font-bold bg-white px-2 py-1 rounded border border-silk-light text-dark-red">{c.code}</span>
                      <p className="text-[10px] text-grey-beige mt-1 uppercase font-medium">Expires: {new Date(c.expiresAt).toLocaleDateString()}</p>
                    </div>
                    <Link to="/admin/coupons" className="text-grey-beige hover:text-dark-red transition-colors">
                      <ChevronDown size={18} className="-rotate-90" />
                    </Link>
                  </div>
                )) : (
                  <p className="text-sm text-grey-beige italic font-medium">No coupons expiring soon.</p>
                )}
             </div>
          </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
