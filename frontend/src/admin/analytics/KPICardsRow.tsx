import React from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  RefreshCw, 
  Users, 
  AlertCircle,
  Percent
} from 'lucide-react';

interface KPICardsRowProps {
  data: {
    totalRevenue: number;
    netRevenue: number;
    totalOrders: number;
    aov: number;
    lostRevenue: number;
    returnRate: number;
    newCustomers: number;
  };
  loading?: boolean;
}

const KPICardsRow: React.FC<KPICardsRowProps> = ({ data, loading }) => {
  const cards = [
    { 
      label: 'Gross Revenue', 
      value: `₹${data.totalRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'bg-blue-50 text-blue-600',
      description: 'Total sales'
    },
    { 
      label: 'Net Revenue', 
      value: `₹${data.netRevenue.toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'bg-green-50 text-green-600',
      description: 'After refunds'
    },
    { 
      label: 'Total Orders', 
      value: data.totalOrders, 
      icon: ShoppingBag, 
      color: 'bg-purple-50 text-purple-600',
      description: 'Order count'
    },
    { 
      label: 'AOV', 
      value: `₹${data.aov.toLocaleString()}`, 
      icon: Percent, 
      color: 'bg-orange-50 text-orange-600',
      description: 'Avg order value'
    },
    { 
      label: 'Lost Revenue', 
      value: `₹${data.lostRevenue.toLocaleString()}`, 
      icon: AlertCircle, 
      color: 'bg-red-50 text-red-600',
      description: 'Stockout impact'
    },
    { 
      label: 'Return Rate', 
      value: `${data.returnRate}%`, 
      icon: RefreshCw, 
      color: 'bg-gray-50 text-gray-600',
      description: 'Refund ratio'
    },
    { 
      label: 'New Customers', 
      value: data.newCustomers, 
      icon: Users, 
      color: 'bg-indigo-50 text-indigo-600',
      description: 'First-time buyers'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((card) => (
        <div 
          key={card.label} 
          className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all ${loading ? 'opacity-50 grayscale' : 'hover:shadow-md'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${card.color}`}>
              <card.icon size={20} />
            </div>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tighter">{card.description}</span>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium">{card.label}</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1 truncate">{card.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPICardsRow;
