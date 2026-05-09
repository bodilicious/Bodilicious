import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, Heart, Zap } from 'lucide-react';

interface CustomerCRMSectionProps {
  segmentStats: any[];
  funnelData: any[];
  loading?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  new: '#3b82f6',        // Blue
  loyal: '#3D0A05',      // Deep Red
  at_risk: '#f59e0b',    // Amber
  high_value: '#10b981', // Emerald
};

const CustomerCRMSection: React.FC<CustomerCRMSectionProps> = ({ 
  segmentStats, 
  funnelData
}) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graph 8: Segment Revenue Share */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            Segment Revenue Distribution
          </h3>
          <div className="h-[300px]">
            {segmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segmentStats}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="segment"
                  >
                    {segmentStats.map((item: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[item.segment] || '#d1d5db'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(val) => val.toUpperCase()} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No segment data</div>
            )}
          </div>
        </div>

        {/* Graph 10: Lifetime Value (CLV) by Segment */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Heart size={20} className="text-red-500" />
            Average CLV by Segment
          </h3>
          <div className="h-[300px]">
            {segmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="segment" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickFormatter={(val) => val.toUpperCase()}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="clv" name="Avg CLV">
                    {segmentStats.map((item: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[item.segment] || '#d1d5db'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No CLV data</div>
            )}
          </div>
        </div>

        {/* Graph 12: Customer Retention Funnel */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Zap size={20} className="text-yellow-500" />
            Retention Funnel: Purchase Frequency
          </h3>
          <div className="h-[300px]">
             {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="_id" 
                    type="category" 
                    width={120} 
                    tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="count" name="Customers" fill="#4b5563" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#9ca3af' }} />
                </BarChart>
              </ResponsiveContainer>
             ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No retention data</div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerCRMSection;
