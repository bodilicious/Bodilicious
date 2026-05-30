import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { TrendingUp, CreditCard } from 'lucide-react';

interface SalesSectionProps {
  salesTrend: any[];
  paymentSplit: any[];
}

const COLORS = ['#3D0A05', '#4a4a4a', '#d1d5db', '#ef4444', '#f59e0b'];

const SalesSection: React.FC<SalesSectionProps> = ({ salesTrend, paymentSplit }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Graph 1: Revenue Trend (Gross vs Net) */}
        <div className="lg:col-span-2 bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Revenue Performance</h3>
              <p className="text-sm text-gray-400">Gross vs Net revenue comparison</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-dark-red rounded-full" /> Gross</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full" /> Net</div>
            </div>
          </div>
          <div className="h-[350px]">
            {salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="_id" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 10 }} 
                    dy={10}
                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    dx={-10}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val/1000)+'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="grossRevenue" 
                    name="Gross Revenue"
                    stroke="#3D0A05" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="netRevenue" 
                    name="Net Revenue"
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <div className="p-4 bg-gray-50 rounded-full">
                  <TrendingUp size={32} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No sales data found for this period</p>
                <button className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-lg text-dark-red hover:bg-gray-50 transition-colors shadow-sm">View Last Month</button>
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Payment Method Mix */}
        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CreditCard size={20} className="text-gray-400" />
              Payment Mix
            </h3>
            <p className="text-sm text-gray-400">Order distribution by method</p>
          </div>
          <div className="h-[280px]">
            {paymentSplit.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="count"
                    nameKey="_id"
                  >
                    {paymentSplit.map((_item: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <div className="p-4 bg-gray-50 rounded-full">
                  <CreditCard size={32} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No payment data yet</p>
                <button className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-lg text-dark-red hover:bg-gray-50 transition-colors shadow-sm">Configure Payments</button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Graph 3: AOV & Order Count Trend */}
      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800">AOV & Volume Efficiency</h3>
            <p className="text-sm text-gray-400">Average net order value vs total order volume</p>
          </div>
          <div className="h-[300px]">
            {salesTrend.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="_id" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 10 }} 
                    dy={10}
                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none' }}
                  />
                  <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#f3f4f6" radius={[4, 4, 0, 0]} />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey={(data) => (data.netRevenue / (data.orders || 1)).toFixed(0)} 
                    name="AOV"
                    stroke="#3D0A05" 
                    strokeWidth={4} 
                    dot={true}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <div className="p-4 bg-gray-50 rounded-full">
                  <TrendingUp size={32} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">Insufficient trend data</p>
                <button className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-lg text-dark-red hover:bg-gray-50 transition-colors shadow-sm">Expand Date Range</button>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default SalesSection;
