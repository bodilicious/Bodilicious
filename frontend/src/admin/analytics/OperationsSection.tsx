import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { Clock, Truck } from 'lucide-react';

interface OperationsSectionProps {
  avgFulfillmentDays: number | string;
  slaBreakdown: Record<string, number>;
  totalDelivered: number;
}

const SLA_COLORS: Record<string, string> = {
  "1 day": "#10b981",    // Green
  "2 days": "#3b82f6",   // Blue
  "3 days": "#f59e0b",   // Amber
  "4+ days": "#ef4444",  // Red
};

const OperationsSection: React.FC<OperationsSectionProps> = ({ 
  avgFulfillmentDays, 
  slaBreakdown,
  totalDelivered
}) => {
  const slaData = Object.entries(slaBreakdown).map(([name, value]) => ({
    name,
    count: value,
    percentage: totalDelivered > 0 ? ((value / totalDelivered) * 100).toFixed(1) : 0
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KPI: Avg Fulfillment Time */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
                <Clock size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium">Avg Fulfillment Time</h3>
            <div className="text-5xl font-black text-gray-800 my-2">{avgFulfillmentDays}</div>
            <p className="text-sm text-gray-400 font-medium">Days from Order to Delivery</p>
        </div>

        {/* Graph 16: Fulfillment SLA Breakdown */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Truck size={20} className="text-gray-400" />
            Fulfillment SLA Performance
          </h3>
          <div className="h-[250px]">
            {slaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: any, _name: any, props: any) => [`${value} Orders (${props.payload.percentage}%)`, "Volume"]}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]}>
                    {slaData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={SLA_COLORS[item.name] || '#d1d5db'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No delivery data available</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default OperationsSection;
