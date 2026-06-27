import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, ShoppingCart, IndianRupee, Users, Package,
  AlertTriangle, ArrowRight, Activity, RefreshCw, BarChart2,
  Tag, Clock, AlertCircle, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const AnalyticsDashboard: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expiringCoupons, setExpiringCoupons] = useState<any[]>([]);
  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchData = useCallback(async (isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      else setIsRefreshing(true);
      const headers = await getAuthHeaders();
      const qp = `startDate=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}`;

      const [salesRes, prodRes, invRes, custRes, behRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/analytics/sales?${qp}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/products?${qp}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/inventory`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/customers?${qp}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/behavioral`, { headers }),
      ]);

      const [sData, pData, iData, cData, bData] = await Promise.all([
        salesRes.json(), prodRes.json(), invRes.json(), custRes.json(), behRes.json()
      ]);

      setData({
        sales: sData.success ? sData.data : null,
        products: pData.success ? pData.data : null,
        inventory: iData.success ? iData.data : null,
        customers: cData.success ? cData.data : null,
        behavioral: bData.success ? bData.data : null,
      });
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [getAuthHeaders, API_URL]);

  useEffect(() => {
    fetchData();
    const i = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(i);
  }, [fetchData]);

  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/v1/admin/coupons/expiring`, { headers });
        const d = await r.json();
        if (d.success) setExpiringCoupons(d.data);
      } catch { /* silent */ }
    };
    load();
  }, [getAuthHeaders, API_URL]);

  const fmt = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const summary = data?.sales?.summary;
  const stockAlerts = data?.inventory?.stockoutImpact || [];
  const totalBackendErrors = (data?.behavioral?.backendErrors || []).reduce((s: number, e: any) => s + e.count, 0);
  const checkoutFailures = data?.behavioral?.checkoutFailureTotal || 0;
  const totalCustomers = (data?.customers?.segmentStats || []).reduce((s: number, x: any) => s + x.customerCount, 0);
  const loyalCount = (data?.customers?.segmentStats || []).find((s: any) => s.segment === 'loyal')?.customerCount || 0;

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-dark-red border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Net Revenue (INR orders)', value: fmt(summary?.netRevenue || 0),
      icon: <IndianRupee size={20} />, color: '#065F46', bg: '#F0FDF4',
      sub: `Gross: ${fmt(summary?.totalRevenue || 0)}`
    },
    {
      label: 'Total Orders', value: (summary?.totalOrders || 0).toLocaleString(),
      icon: <ShoppingCart size={20} />, color: '#1D4ED8', bg: '#EFF6FF',
      sub: `AOV (INR): ${fmt(summary?.aov || 0)} | Int'l Orders: ${summary?.foreignOrdersCount || 0}`
    },
    {
      label: 'Total Customers', value: totalCustomers.toLocaleString(),
      icon: <Users size={20} />, color: '#7C3AED', bg: '#F5F3FF',
      sub: `${loyalCount} loyal buyers`
    },
    {
      label: 'Checkout Failures', value: checkoutFailures,
      icon: <AlertCircle size={20} />, color: '#D97706', bg: '#FFFBEB',
      sub: `₹${(data?.behavioral?.checkoutRevenueLost || 0).toLocaleString()} at risk`
    },
    {
      label: 'Backend Errors', value: totalBackendErrors,
      icon: <Zap size={20} />, color: '#DC2626', bg: '#FEF2F2',
      sub: `${(data?.behavioral?.backendErrors || []).length} error types`
    },
    {
      label: 'Stockout Impact', value: stockAlerts.length,
      icon: <Package size={20} />, color: '#9A3412', bg: '#FFF7ED',
      sub: stockAlerts.length > 0 ? `₹${stockAlerts[0]?.estimatedDailyLoss?.toLocaleString()}/day top loss` : 'All in stock'
    },
  ];

  return (
    <div className="space-y-8 pb-16">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-serif font-bold text-dark-red tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1 font-medium">30-day snapshot — last updated just now</p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2.5 bg-[#F5F2EC] text-dark-red hover:bg-ruby-red hover:text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <Link
            to="/admin/analytics"
            className="flex items-center gap-2 px-5 py-2.5 bg-dark-red text-white rounded-xl text-sm font-bold hover:bg-red-900 transition-colors shadow-md cursor-pointer"
          >
            <BarChart2 size={16} /> Full Analytics
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            style={{ background: kpi.bg, border: '1px solid rgba(255,255,255,0.8)' }}
            className="rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.8)', borderRadius: 12 }}>
                <div style={{ color: kpi.color }}>{kpi.icon}</div>
              </div>
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</div>
            <div className="text-3xl font-black" style={{ color: kpi.color, fontFamily: 'Playfair Display, serif' }}>{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Analytics sections quick access */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Analytics Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Sales & Revenue', sub: 'Revenue trends, payment mix, AOV', icon: <TrendingUp size={18} />, section: 'sales', color: '#065F46', bg: '#F0FDF4' },
            { label: 'Products & Categories', sub: 'Top sellers, category share, return rates', icon: <Package size={18} />, section: 'products', color: '#1D4ED8', bg: '#EFF6FF' },
            { label: 'Customers & Segments', sub: 'New vs returning, CLV, retention funnel', icon: <Users size={18} />, section: 'customers', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Operations', sub: 'Fulfillment time, SLA performance', icon: <Clock size={18} />, section: 'operations', color: '#9A3412', bg: '#FFF7ED' },
            { label: 'Insights & Behavioral', sub: 'Peak times heatmap, error rates', icon: <Activity size={18} />, section: 'behavioral', color: '#D97706', bg: '#FFFBEB' },
            { label: 'Deep Intelligence', sub: 'Product funnel, cohorts, at-risk customers', icon: <BarChart2 size={18} />, section: 'overview', color: '#BE185D', bg: '#FDF2F8' },
          ].map(item => (
            <Link
              key={item.label}
              to={`/admin/analytics?section=${item.section}`}
              style={{ background: item.bg, border: '1px solid rgba(255,255,255,0.9)' }}
              className="group rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div style={{ padding: 10, background: 'rgba(255,255,255,0.8)', borderRadius: 12, color: item.color }} className="shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Two alert panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Stockout Alerts */}
        <div className="bg-dark-red rounded-2xl p-7 text-white shadow-xl shadow-dark-red/20">
          <h3 className="text-lg font-serif font-bold mb-5 flex items-center gap-2">
            <AlertTriangle size={18} /> Inventory Alerts
          </h3>
          <div className="space-y-3">
            {stockAlerts.slice(0, 3).map((item: any) => (
              <div key={item.pid} className="flex items-center justify-between bg-white/10 p-4 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs text-red-100 italic">{item.name}</p>
                  <p className="font-bold text-sm">₹{item.estimatedDailyLoss?.toLocaleString()} / day</p>
                </div>
                <AlertTriangle size={16} className="opacity-60" />
              </div>
            ))}
            {stockAlerts.length === 0 && (
              <p className="text-sm text-red-100 opacity-60">All items currently in stock ✓</p>
            )}
          </div>
          <Link to="/admin/products" className="block w-full mt-5 py-2.5 bg-white text-dark-red text-center font-bold rounded-xl hover:bg-silk-light transition-colors text-sm cursor-pointer">
            Manage Inventory
          </Link>
        </div>

        {/* Expiring Coupons */}
        <div className="bg-white rounded-2xl p-7 border border-silk shadow-sm">
          <h3 className="text-lg font-serif font-bold text-dark-red mb-5 flex items-center gap-2">
            <Tag size={18} className="text-ruby-red" /> Expiring Coupons
          </h3>
          <div className="space-y-3">
            {expiringCoupons.length > 0 ? expiringCoupons.slice(0, 4).map(c => (
              <div key={c._id} className="flex items-center justify-between p-3 bg-silk-light/50 rounded-xl border border-silk-light">
                <div>
                  <span className="font-mono text-xs font-bold bg-white px-2 py-1 rounded border border-silk-light text-dark-red">{c.code}</span>
                  <p className="text-[10px] text-grey-beige mt-1 uppercase font-medium">Expires {new Date(c.expiresAt).toLocaleDateString()}</p>
                </div>
                <Link to="/admin/coupons" className="text-grey-beige hover:text-dark-red transition-colors cursor-pointer">
                  <ArrowRight size={16} />
                </Link>
              </div>
            )) : (
              <p className="text-sm text-grey-beige italic">No coupons expiring soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
