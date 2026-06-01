import React, { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, Users, ShoppingCart, IndianRupee,
  Activity, Package, Calendar, RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Select from '../components/Select';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';

type Tab = 'overview' | 'products' | 'cohorts';

const IntelligenceDashboard: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [trendingData, setTrendingData] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('30');

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      const [summaryRes, trendingRes, cohortRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/analytics/executive-summary?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/trending-products?days=${timeRange}`, { headers }),
        fetch(`${API_URL}/api/v1/admin/analytics/cohorts`, { headers })
      ]);

      const [summary, trending, cohorts] = await Promise.all([
        summaryRes.json(),
        trendingRes.json(),
        cohortRes.json()
      ]);

      if (summary.success) setSummaryData(summary.data);
      if (trending.success) setTrendingData(trending.data);
      if (cohorts.success) setCohortData(cohorts.data);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-dark-red">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Customer Intelligence (V2)</h3>
            <p className="text-sm text-gray-500">Real-time cohorts and precomputed analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select
            className="w-40"
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
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-2xl w-full md:w-fit border border-gray-100">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
        >
          Executive Overview
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
        >
          Trending Products
        </button>
        <button
          onClick={() => setActiveTab('cohorts')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'cohorts' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
        >
          Customer Retention
        </button>
      </div>

      {loading && !summaryData ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin text-dark-red"><RefreshCw size={32} /></div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && summaryData && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Net Revenue</p>
                    <h3 className="text-3xl font-black text-gray-800">{formatCurrency(summaryData.summary.netRevenue)}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                    <IndianRupee size={28} />
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total Orders</p>
                    <h3 className="text-3xl font-black text-gray-800">{summaryData.summary.orders}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ShoppingCart size={28} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Order Value</p>
                    <h3 className="text-3xl font-black text-gray-800">{formatCurrency(summaryData.summary.averageOrderValue)}</h3>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <TrendingUp size={28} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="mb-6 flex justify-between items-center">
                  <h4 className="font-bold text-gray-800">Revenue Trend (Net vs Gross)</h4>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summaryData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b0000" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#8b0000" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date_string" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af', fontSize: 12}}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                        }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af', fontSize: 12}}
                        tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: any) => formatCurrency(Number(value) || 0)}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Area type="monotone" dataKey="net_revenue" stroke="#8b0000" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                      <Line type="monotone" dataKey="gross_revenue" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: TRENDING PRODUCTS */}
          {activeTab === 'products' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package className="text-dark-red" size={20} /> Top Performing Products
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                      <th className="p-4 pl-6">Rank</th>
                      <th className="p-4">Product</th>
                      <th className="p-4 text-right">Units Sold</th>
                      <th className="p-4 text-right pr-6">Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trendingData.map((item, index) => (
                      <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 pl-6 text-sm font-bold text-gray-400">
                          #{index + 1}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {item.images && item.images[0] ? (
                              <img src={item.images[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200" />
                            )}
                            <p className="font-bold text-gray-800 text-sm max-w-[300px] truncate">{item.name}</p>
                          </div>
                        </td>
                        <td className="p-4 text-right font-black text-gray-800">
                          {item.totalPurchases}
                        </td>
                        <td className="p-4 text-right pr-6 font-black text-dark-red">
                          {formatCurrency(item.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                    {trendingData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-gray-500">
                          No product data available for this time range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 3: COHORTS */}
          {activeTab === 'cohorts' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-blue-800 text-sm">
                <Calendar className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold mb-1">How to read this chart:</p>
                  <p className="text-blue-700">Cohorts track customer retention over time. Month 0 is the month they made their first purchase. Month 1 is the percentage of those same customers who returned to buy again the next month.</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto p-6">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs border-b border-gray-100 min-w-[120px]">Cohort Month</th>
                        <th className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs border-b border-gray-100 min-w-[100px]">Total Users</th>
                        {[...Array(6)].map((_, i) => (
                          <th key={i} className="p-3 font-bold text-gray-400 uppercase tracking-widest text-xs text-center border-b border-gray-100 min-w-[80px]">
                            Month {i}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cohortData.map((cohort, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-bold text-gray-800">{cohort.cohort}</td>
                          <td className="p-3 font-medium text-gray-500 flex items-center gap-1">
                            <Users size={14}/> {cohort.total_users}
                          </td>
                          {[...Array(6)].map((_, i) => {
                            const monthData = cohort.months[i];
                            if (!monthData) return <td key={i} className="p-3 bg-gray-50/30"></td>;
                            
                            const pct = monthData.retention_percent;
                            const isM0 = i === 0;
                            
                            return (
                              <td key={i} className="p-1 text-center">
                                <div 
                                  className={`w-full h-full p-2 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-105 cursor-default ${isM0 ? 'bg-dark-red/10 text-dark-red' : ''}`}
                                  style={!isM0 && pct > 0 ? { backgroundColor: `rgba(139, 0, 0, ${Math.max(0.05, pct / 40)})`, color: pct > 20 ? 'white' : 'black' } : {}}
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
                          <td colSpan={8} className="p-12 text-center text-gray-500">
                            No cohort data available yet.
                          </td>
                        </tr>
                      )}
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

export default IntelligenceDashboard;
