import React, { useState } from 'react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Line, ComposedChart, ScatterChart, Scatter, FunnelChart, Funnel, LabelList, PieChart, Pie, Legend
} from 'recharts';
import { Truck, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';

interface OperationsSectionProps {
  data: {
    carrierPerformance: Array<{
      courier_name: string;
      count: number;
      avgOrderToDeliveryDays: number;
      avgCarrierTransitDays: number;
    }>;
    heatmap: {
      state: Array<{ state: string; order_count: number; avg_shipping_cost: number }>;
      pincode: Array<{ pincode: string; order_count: number; avg_shipping_cost: number }>;
    };
    costAnalysis: Array<{
      order_id: string;
      totalAmount: number;
      shippingCost: number;
      freight_pct_of_value: number;
    }>;
    funnel: {
      total_processed: number;
      shipped: number;
      delivered: number;
      rto: number;
    };
    rtoReasons: Array<{
      reason: string;
      count: number;
    }>;
  };
  fetchPincodeHeatmap?: (stateName: string) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const OperationsSection: React.FC<OperationsSectionProps> = ({ data, fetchPincodeHeatmap }) => {
  const [carrierMode, setCarrierMode] = useState<"transit" | "orderToDelivery">("transit");
  const [selectedState, setSelectedState] = useState<string | null>(null);

  if (!data || !data.carrierPerformance) {
    return <div className="text-gray-400 p-8 text-center">Loading operations data...</div>;
  }

  const { carrierPerformance, heatmap, costAnalysis, funnel, rtoReasons } = data;

  const funnelData = [
    { name: "Total Processed", value: funnel.total_processed, fill: "#3b82f6" },
    { name: "Shipped", value: funnel.shipped, fill: "#6366f1" },
    { name: "Delivered", value: funnel.delivered, fill: "#10b981" },
    { name: "RTO", value: funnel.rto, fill: "#ef4444" }
  ];

  const handleStateClick = (state: string) => {
    setSelectedState(state);
    if (fetchPincodeHeatmap) fetchPincodeHeatmap(state);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Carrier Performance */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Truck size={20} className="text-gray-400" />
            Carrier Performance (Avg Delivery Time)
          </h3>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${carrierMode === 'transit' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setCarrierMode("transit")}
            >
              Carrier Transit Time
            </button>
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${carrierMode === 'orderToDelivery' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setCarrierMode("orderToDelivery")}
            >
              Order-to-Delivery
            </button>
          </div>
        </div>
        
        <div className="h-[350px]">
          {carrierPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={carrierPerformance} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" xAxisId="bottom" hide />
                <XAxis type="number" xAxisId="top" orientation="top" hide />
                <YAxis dataKey="courier_name" type="category" yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontWeight: 500 }} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => {
                    if (name === "Volume") return [value, "Shipments"];
                    return [`${Number(value).toFixed(1)} Days`, name === 'avgCarrierTransitDays' ? 'Transit Time' : 'Order to Delivery'];
                  }}
                />
                <Legend />
                <Bar 
                  xAxisId="bottom" 
                  yAxisId="left" 
                  dataKey={carrierMode === "transit" ? "avgCarrierTransitDays" : "avgOrderToDeliveryDays"} 
                  name={carrierMode === "transit" ? "Avg Transit Time" : "Avg Order-to-Delivery"} 
                  fill={carrierMode === "transit" ? "#3b82f6" : "#8b5cf6"} 
                  barSize={32}
                  radius={[0, 6, 6, 0]}
                >
                  <LabelList dataKey={carrierMode === "transit" ? "avgCarrierTransitDays" : "avgOrderToDeliveryDays"} position="right" formatter={(v: any) => v ? Number(v).toFixed(1) + 'd' : ''} fill="#6b7280" fontSize={12} />
                </Bar>
                <Line xAxisId="top" yAxisId="left" type="monotone" dataKey="count" name="Volume" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No carrier data available</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 1.2: Geographical Heatmap (State & Pincode) */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <MapPin size={20} className="text-gray-400" />
            Geographical Distribution
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {!selectedState ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-500 mb-4">Click a state to view top pincodes</div>
                {heatmap.state.map((s, i) => (
                  <div key={i} className="group cursor-pointer" onClick={() => handleStateClick(s.state)}>
                    <div className="flex justify-between items-end mb-1">
                      <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{s.state === 'Unknown' ? 'Other' : s.state}</span>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">{s.order_count} orders</div>
                        <div className="text-xs text-gray-500">₹{Math.round(s.avg_shipping_cost)} avg ship cost</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.max(2, (s.order_count / Math.max(...heatmap.state.map(x => x.order_count))) * 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setSelectedState(null)} className="text-sm text-blue-600 hover:underline">← Back to States</button>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm font-bold text-gray-700">{selectedState} Pincodes</span>
                </div>
                {heatmap.pincode && heatmap.pincode.length > 0 ? (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Pincode</th>
                        <th className="px-4 py-3">Orders</th>
                        <th className="px-4 py-3 rounded-tr-lg">Avg Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.pincode.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{p.pincode}</td>
                          <td className="px-4 py-3 text-gray-600">{p.order_count}</td>
                          <td className="px-4 py-3 text-gray-600">₹{Math.round(p.avg_shipping_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading pincodes...</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1.3: Cost Analysis */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-gray-400" />
            Shipping Cost vs Order Value Margin
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" dataKey="totalAmount" name="Order Value" unit="₹" tick={{fill: '#6b7280', fontSize: 12}} label={{ value: 'Order Value (₹)', position: 'insideBottom', offset: -10, fill: '#4b5563', fontSize: 12 }} />
                <YAxis type="number" dataKey="freight_pct_of_value" name="Freight %" unit="%" tick={{fill: '#6b7280', fontSize: 12}} label={{ value: 'Shipping Cost % of Value', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 12 }} />
                <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any, name: any) => [Number(value).toFixed(1) + (name === 'Freight %' ? '%' : ''), name]} />
                <Scatter name="Orders" data={costAnalysis} fill="#8b5cf6" opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION 1.4: RTO Rate Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-gray-400" />
            Order Fulfillment Funnel (RTO Rate)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel
                  dataKey="value"
                  data={funnelData}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <AlertTriangle size={20} className="text-gray-400" />
            RTO Reasons
          </h3>
          <div className="h-[300px]">
            {rtoReasons.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rtoReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="reason"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {rtoReasons.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No RTO reason data</div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default OperationsSection;
