import React, { useEffect, useState, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, ShieldAlert, Terminal, Clock, 
  ShoppingCart, UserPlus, XCircle, RefreshCw, Search,
  ChevronDown, ChevronUp, Box, FileJson
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Select from '../components/Select';
import DateRangePicker from './analytics/DateRangePicker';
import { useLocation } from 'react-router-dom';

const AuditLogs: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [eventTypeFilter, setEventTypeFilter] = useState(queryParams.get('event_type') || '');
  const [severityFilter, setSeverityFilter] = useState('');
  const [isAnomalyFilter, setIsAnomalyFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 30 Days'
  });

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (searchTerm) params.append('search', searchTerm);
      if (eventTypeFilter) params.append('event_type', eventTypeFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (isAnomalyFilter) params.append('is_anomaly', isAnomalyFilter);
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const res = await fetch(`${API_URL}/api/v1/admin/logs?${params.toString()}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.data);
        setTotal(data.total);
        setPages(data.pages);
      }
    } catch (err) {
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, page, searchTerm, eventTypeFilter, severityFilter, isAnomalyFilter, dateRange]);

  // Use a debounced effect to fetch logs whenever dependencies change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLogs();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchLogs]);

  const getActionColor = (action: string) => {
    const act = (action || '').toUpperCase();
    switch (act) {
      case 'ORDER_PLACED': return 'text-green-600 bg-green-50 border-green-100';
      case 'NEW_CUSTOMER': return 'text-cyan-600 bg-cyan-50 border-cyan-100';
      case 'ORDER_CANCELLED': return 'text-red-600 bg-red-50 border-red-100';
      case 'REFUND_CONFIRMED': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'PROMOTE_USER': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'BLOCK_USER': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'EXPORT_ORDERS': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'LOGIN_FAILED': return 'text-red-600 bg-red-50 border-red-100';
      default:
        if (act.includes('PROMOTE')) return 'text-indigo-600 bg-indigo-50 border-indigo-100';
        if (act.includes('BLOCK')) return 'text-orange-600 bg-orange-50 border-orange-100';
        if (act.includes('EXPORT')) return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getActionIcon = (action: string) => {
    const act = (action || '').toUpperCase();
    switch (act) {
      case 'ORDER_PLACED': return <ShoppingCart size={18} />;
      case 'NEW_CUSTOMER': return <UserPlus size={18} />;
      case 'ORDER_CANCELLED': return <XCircle size={18} />;
      case 'REFUND_CONFIRMED': return <RefreshCw size={18} />;
      case 'PROMOTE_USER': return <UserPlus size={18} />;
      case 'BLOCK_USER': return <ShieldAlert size={18} />;
      case 'LOGIN_FAILED': return <ShieldAlert size={18} />;
      case 'STOCK_BULK_IMPORT': return <Box size={18} />;
      case 'STOCK_RESTOCK_ON_RETURN': return <RefreshCw size={18} />;
      default: return <Terminal size={18} />;
    }
  };

  const resolveActor = (log: any) => {
    if (log.user_id) return { label: log.user_id.name || log.user_id.email || 'Authorized User', source: 'Auth', badge: 'bg-indigo-100 text-indigo-700' };
    return { label: 'System', source: 'System', badge: 'bg-gray-100 text-gray-700' };
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-6 rounded-3xl border border-gray-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-dark-red">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Security Audit Logs</h3>
            <p className="text-sm text-gray-500">Immutable record of system & administrative activity</p>
          </div>
        </div>
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search events, IDs, or users..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-all shadow-sm"
            />
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Events</p>
            <p className="text-2xl font-black text-gray-800">{total}</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <DateRangePicker onRangeChange={(range: any) => { setDateRange(range); setPage(1); }} currentRange={dateRange} />
          <Select
            className="w-48"
            value={eventTypeFilter}
            onChange={(val) => { setEventTypeFilter(val as string); setPage(1); }}
            options={[
              { value: '', label: 'All Events' },
              { value: 'ORDER_PLACED', label: 'Order Placed' },
              { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
              { value: 'ORDER_CREATION_FAILED', label: 'Order Creation Failed' },
              { value: 'PAYMENT_CAPTURED', label: 'Payment Captured' },
              { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
              { value: 'LOGIN_SUCCESS', label: 'Login Success' },
              { value: 'LOGIN_FAILED', label: 'Login Failed' }
            ]}
          />
          <Select
            className="w-40"
            value={severityFilter}
            onChange={(val) => { setSeverityFilter(val as string); setPage(1); }}
            options={[
              { value: '', label: 'All Severities' },
              { value: 'INFO', label: 'INFO' },
              { value: 'WARNING', label: 'WARNING' },
              { value: 'ERROR', label: 'ERROR' },
              { value: 'CRITICAL', label: 'CRITICAL' }
            ]}
          />
          <Select
            className="w-40"
            value={isAnomalyFilter}
            onChange={(val) => { setIsAnomalyFilter(val as string); setPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'true', label: 'Anomalies Only' },
              { value: 'false', label: 'Normal Events' }
            ]}
          />
        </div>
        
        <button
          onClick={async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${API_URL}/api/v1/admin/logs/export?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers });
              if (!res.ok) throw new Error();
              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit_logs_export_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            } catch (err) {
              toast.error('Failed to export logs');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-dark-red text-white rounded-xl text-sm font-medium hover:bg-ruby-red transition-all shadow-sm whitespace-nowrap w-full md:w-auto justify-center"
        >
          <Search size={16} /> Export CSV
        </button>
      </div>

      {/* Log List */}
      <div className="space-y-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 animate-pulse rounded-2xl" />
          ))
        ) : logs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-3xl border border-gray-100 border-dashed">
            <Terminal className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No events found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search filters.</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const actor = resolveActor(log);
            const isExpanded = expandedId === (log._id || log.event_id);
            const isAnomaly = log.flags?.is_anomaly;

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                key={log._id || log.event_id} 
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isAnomaly 
                    ? 'border-red-300 bg-red-50/30' 
                    : isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-100 hover:border-red-200 hover:shadow-sm'
                }`}
              >
                {/* Header Row (Clickable) */}
                <div 
                  onClick={() => toggleExpand(log._id || log.event_id)}
                  className="p-5 flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${getActionColor(log.event_type)}`}>
                        {getActionIcon(log.event_type)}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest border shadow-sm ${getActionColor(log.event_type)}`}>
                          {log.event_type}
                        </span>
                        {isAnomaly && (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-widest border text-red-700 bg-red-100 border-red-300 shadow-sm animate-pulse">
                            🚨 ANOMALY DETECTED
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-800 text-sm">
                            {actor.label}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${actor.badge}`}>
                            {actor.source}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                        {log.correlation_id && (
                          <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">
                            <Terminal size={12} /> {log.correlation_id}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={12} /> {new Date(log.timestamp_utc).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-xs text-gray-500 italic max-w-[200px] truncate">
                        {log.metadata?.reason || log.metadata?.role || log.metadata?.range || 'View details'}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        {log.source_system && (
                          <span className="text-[9px] text-gray-400 font-mono uppercase px-1.5 py-0.5 border border-gray-200 rounded bg-gray-50">
                            via {log.source_system}
                          </span>
                        )}
                        {log.network?.ip_address && (
                          <p className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {log.network.ip_address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-gray-100 text-gray-800' : 'text-gray-400 group-hover:text-gray-600 group-hover:bg-gray-50'}`}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expandable Details Section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 bg-gray-50/50"
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Event Context */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <FileJson size={14} /> Event Context
                            </h5>
                            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-xs font-mono text-gray-700 overflow-x-auto">
                              <table className="w-full text-left">
                                <tbody>
                                  <tr>
                                    <th className="py-1 pr-4 text-gray-400 font-normal">Event ID</th>
                                    <td className="py-1 break-all">{log.event_id || log._id}</td>
                                  </tr>
                                  <tr>
                                    <th className="py-1 pr-4 text-gray-400 font-normal">Severity</th>
                                    <td className="py-1">
                                      <span className={`px-2 py-0.5 rounded-md ${log.severity === 'INFO' ? 'bg-blue-50 text-blue-700' : log.severity === 'WARNING' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                                        {log.severity || 'INFO'}
                                      </span>
                                    </td>
                                  </tr>
                                  {log.session_id && (
                                    <tr>
                                      <th className="py-1 pr-4 text-gray-400 font-normal">Session ID</th>
                                      <td className="py-1 break-all">{log.session_id}</td>
                                    </tr>
                                  )}
                                  {log.network?.user_agent && (
                                    <tr>
                                      <th className="py-1 pr-4 text-gray-400 font-normal">User Agent</th>
                                      <td className="py-1 break-words">{log.network.user_agent}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Metadata Payload */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <Box size={14} /> Metadata Payload
                            </h5>
                            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 shadow-inner overflow-x-auto">
                              <pre className="text-xs font-mono text-[#d4d4d4] leading-relaxed">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && total > 0 && (
        <div className="flex justify-between items-center pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-medium">
            Viewing page <span className="text-gray-800 font-bold">{pages === 0 ? 0 : page}</span> of <span className="text-gray-800 font-bold">{pages}</span>
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-3 bg-white border border-gray-200 rounded-2xl disabled:opacity-30 hover:bg-gray-50 hover:text-dark-red transition-all shadow-sm disabled:shadow-none"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              disabled={page >= pages || pages === 0}
              onClick={() => setPage(p => p + 1)}
              className="p-3 bg-white border border-gray-200 rounded-2xl disabled:opacity-30 hover:bg-gray-50 hover:text-dark-red transition-all shadow-sm disabled:shadow-none"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
