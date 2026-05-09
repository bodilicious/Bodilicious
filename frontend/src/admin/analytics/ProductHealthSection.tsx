import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Package, RefreshCw, Trophy } from 'lucide-react';

interface ProductHealthSectionProps {
  topSelling: any[];
  categoryRevenue: any[];
  returnRates: any[];
  loading?: boolean;
}

const COLORS = ['#3D0A05', '#4a4a4a', '#d1d5db', '#ef4444', '#f59e0b', '#3b82f6'];

const ProductHealthSection: React.FC<ProductHealthSectionProps> = ({ 
  topSelling, 
  categoryRevenue, 
  returnRates
}) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graph 4: Category Revenue Share */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Package size={20} className="text-gray-400" />
            Category Revenue Share
          </h3>
          <div className="h-[300px]">
            {categoryRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryRevenue}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="_id"
                  >
                    {categoryRevenue.map((_item: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No category sales data</div>
            )}
          </div>
        </div>

        {/* Graph 5: Top 10 Best Sellers */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" />
            Top 10 Selling Products
          </h3>
          <div className="h-[300px]">
            {topSelling.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSelling} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="productInfo.name" 
                    type="category" 
                    width={120} 
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="totalSold" name="Units Sold" fill="#3D0A05" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No sales data</div>
            )}
          </div>
        </div>

        {/* Graph 6: Top 10 Highest Return Rate SKUs */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <RefreshCw size={20} className="text-red-500" />
            Top 10 Highest Return Rate SKUs
          </h3>
          <div className="h-[300px]">
            {returnRates.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnRates}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 10 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    formatter={(value: any) => `${value}%`}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="returnRate" name="Return Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No return data recorded yet</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductHealthSection;
