import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  AlertCircle, 
  ShoppingCart, 
  ServerCrash,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import DateRangePicker from './analytics/DateRangePicker';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

const ErrorDashboardPage: React.FC = () => {
  const { getAuthHeaders } = useApp();
  
  // Date range defaults to last 7 days
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 7 Days'
  });

  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const qp = new URLSearchParams({
          from: dateRange.startDate,
          to: dateRange.endDate,
          page: page.toString(),
          limit: limit.toString()
        }).toString();

        const res = await fetch(`${API_URL}/api/v1/admin/analytics/errors?${qp}`, { headers });
        const json = await res.json();

        if (json.success) {
          setData(json.data);
        } else {
          toast.error("Failed to fetch error data");
        }
      } catch (err) {
        console.error("Error fetching error dashboard:", err);
        toast.error("Error loading dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, page, getAuthHeaders]);

  const checkoutFailures = data?.checkoutFailures || [];
  const gatewayData = data?.gatewayBreakdown || [];
  const paymentRows = data?.paymentFailureRows || [];
  const systemRows = data?.systemErrorRows || [];
  const totalPayment = data?.paymentFailureTotal || 0;
  const totalSystem = data?.systemErrorTotal || 0;

  const totalPagesPayment = Math.ceil(totalPayment / limit);
  const totalPagesSystem = Math.ceil(totalSystem / limit);
  const maxPages = Math.max(totalPagesPayment, totalPagesSystem, 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-dark-red flex items-center gap-2">
            <AlertOctagon className="text-red-600" /> Error Rate Dashboard
          </h2>
          <p className="text-gray-500 text-sm mt-1">Detailed breakdown of payment failures and backend anomalies</p>
        </div>
        <DateRangePicker 
          currentRange={dateRange} 
          onRangeChange={(r) => { setDateRange(r); setPage(1); }} 
        />
      </div>

      {loading && !data ? (
        <div className="h-64 flex items-center justify-center text-gray-400">Loading metrics...</div>
      ) : (
        <>
          {/* Top charts */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <AlertCircle size={18} className="text-amber-600" />
              <h3 className="text-lg font-bold text-gray-800">Checkout & Gateway Failures</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 h-[280px]">
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
                  <div className="h-full flex flex-col items-center justify-center">
                    <ShoppingCart size={28} className="text-emerald-400 mb-2" />
                    <p className="text-sm text-gray-400 font-medium">No checkout failures in range</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Gateway Decline Reasons</h4>
                {gatewayData.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {gatewayData.map((gw: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-700 font-mono text-xs">{gw.reason}</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">{gw.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No detailed gateway errors found.</p>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Payment Failures Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <h3 className="font-bold text-gray-800 text-sm">Payment Failures Details</h3>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{totalPayment} total</span>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {paymentRows.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentRows.map((row: any) => (
                        <tr key={row._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(row.timestamp_utc).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{row.user_id?.name || 'Guest'}</div>
                            <div className="text-xs text-gray-500">{row.user_id?.email || row.metadata?.email || 'No email'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-mono text-red-600 truncate max-w-[200px]" title={row.metadata?.reason || 'Unknown error'}>
                              {row.metadata?.reason || 'Unknown error'}
                            </div>
                            {row.metadata?.order_id && <div className="text-[10px] text-gray-400 mt-1">{row.metadata.order_id}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">No detailed payment failures available for this page.</div>
                )}
              </div>
            </div>

            {/* System Errors Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ServerCrash size={16} className="text-purple-500" />
                  <h3 className="font-bold text-gray-800 text-sm">System Backend Errors</h3>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{totalSystem} total</span>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {systemRows.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Event Type</th>
                        <th className="px-4 py-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {systemRows.map((row: any) => (
                        <tr key={row._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(row.timestamp_utc).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-medium text-purple-700 text-xs whitespace-nowrap">
                            {row.event_type}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-600 line-clamp-2" title={row.metadata?.message || row.metadata?.error || JSON.stringify(row.metadata)}>
                              {row.metadata?.message || row.metadata?.error || JSON.stringify(row.metadata)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">No backend system errors for this page.</div>
                )}
              </div>
            </div>

          </div>

          {/* Pagination Controls */}
          {maxPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-gray-600">Page {page} of {maxPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(maxPages, p + 1))}
                disabled={page === maxPages}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ErrorDashboardPage;
