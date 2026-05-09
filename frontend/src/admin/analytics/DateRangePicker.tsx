import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface DateRangePickerProps {
  onRangeChange: (range: DateRange) => void;
  currentRange: DateRange;
}

const PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Year to Date', specialized: 'ytd' },
  { label: 'All Time', specialized: 'all' },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onRangeChange, currentRange }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetSelect = (preset: any) => {
    const end = new Date();
    let start = new Date();

    if (preset.specialized === 'ytd') {
      start = new Date(end.getFullYear(), 0, 1);
    } else if (preset.specialized === 'all') {
      start = new Date(2023, 0, 1); // Project launch or early date
    } else {
      start.setDate(end.getDate() - preset.days);
    }

    onRangeChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      label: preset.label
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-dark-red transition-colors"
      >
        <Calendar size={16} className="text-gray-400" />
        <span>{currentRange.label}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden py-2">
            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
              Select Range
            </div>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePresetSelect(p)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  currentRange.label === p.label 
                    ? 'bg-red-50 text-dark-red font-semibold' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
            
            <div className="border-t border-gray-50 mt-2 pt-2 px-2">
               <div className="px-2 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custom Range</div>
               <div className="space-y-2">
                 <input 
                   type="date" 
                   value={currentRange.startDate}
                   onChange={(e) => onRangeChange({ ...currentRange, startDate: e.target.value, label: 'Custom' })}
                   className="w-full text-xs p-2 border border-gray-100 rounded-lg outline-none focus:ring-1 ring-dark-red/20"
                 />
                 <input 
                   type="date" 
                   value={currentRange.endDate}
                   onChange={(e) => onRangeChange({ ...currentRange, endDate: e.target.value, label: 'Custom' })}
                   className="w-full text-xs p-2 border border-gray-100 rounded-lg outline-none focus:ring-1 ring-dark-red/20"
                 />
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;
