import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Sparkles, Activity, Target } from 'lucide-react';

interface RitualAnalyticsSectionProps {
  skinTypes: any[];
  concerns: any[];
  funnel: any[];
}

const COLORS = ['#3D0A05', '#4a4a4a', '#d1d5db', '#ef4444', '#f59e0b', '#3b82f6'];

const RitualAnalyticsSection: React.FC<RitualAnalyticsSectionProps> = ({ 
  skinTypes, 
  concerns, 
  funnel
}) => {
  // Sort funnel data in order: started -> completed -> viewed_recommendations -> placed_order
  const funnelOrder = ["started", "completed", "viewed_recommendations", "placed_order"];
  const sortedFunnel = funnelOrder.map(step => {
    const entry = funnel.find(f => f._id === step);
    return {
      name: step.replace('_', ' ').toUpperCase(),
      count: entry ? entry.count : 0
    };
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graph 17: Top Skin Concerns */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Target size={20} className="text-gray-400" />
            Top Skin Concerns
          </h3>
          <div className="h-[300px]">
            {concerns.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concerns.slice(0, 10)} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="_id" 
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
                  <Bar dataKey="count" name="Users" fill="#3D0A05" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No concern data recorded</div>
            )}
          </div>
        </div>

        {/* Graph 18: Skin Type Distribution */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Sparkles size={20} className="text-gray-400" />
            Skin Type Distribution
          </h3>
          <div className="h-[300px]">
            {skinTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skinTypes}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="_id"
                  >
                    {skinTypes.map((_item: any, index: number) => (
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
              <div className="h-full flex items-center justify-center text-gray-400">No skin type data</div>
            )}
          </div>
        </div>

        {/* Graph 19: Ritual Finder Conversion Funnel */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-green-500" />
            Ritual Finder Conversion Funnel
          </h3>
          <div className="h-[300px]">
            {sortedFunnel.some(f => f.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedFunnel} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={180} 
                    tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="count" name="Users" fill="#10b981" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fill: '#9ca3af' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No funnel data recorded yet</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default RitualAnalyticsSection;
