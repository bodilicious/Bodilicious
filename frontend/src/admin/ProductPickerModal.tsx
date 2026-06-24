import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Search } from 'lucide-react';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPids: string[];
  onSave: (pids: string[]) => void;
  maxSelections?: number;
}

export default function ProductPickerModal({ isOpen, onClose, selectedPids, onSave, maxSelections = 999 }: ProductPickerModalProps) {
  const { products } = useApp();
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState<string[]>(selectedPids || []);

  if (!isOpen) return null;

  const filteredProducts = (products || []).filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.pid.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProduct = (pid: string) => {
    if (localSelection.includes(pid)) {
      setLocalSelection(localSelection.filter(id => id !== pid));
    } else {
      if (localSelection.length >= maxSelections) return;
      setLocalSelection([...localSelection, pid]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="font-serif text-lg text-dark-red">Select Products</h3>
            <p className="text-xs text-slate-500 font-sans">{localSelection.length} selected</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-sans focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.map(product => {
            const isSelected = localSelection.includes(product.pid);
            const isDisabled = !isSelected && localSelection.length >= maxSelections;
            
            return (
              <div 
                key={product.pid}
                onClick={() => !isDisabled && toggleProduct(product.pid)}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-dark-red bg-red-50/30' 
                    : isDisabled 
                      ? 'border-slate-100 opacity-50 cursor-not-allowed' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                  isSelected ? 'bg-dark-red border-dark-red' : 'border-slate-300'
                }`}>
                  {isSelected && <X size={12} className="text-white rotate-45" />}
                </div>
                <div className="w-12 h-12 rounded bg-slate-100 shrink-0 overflow-hidden">
                  {product.images?.[0] && (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-sm text-slate-900 truncate">{product.name}</p>
                  <p className="font-sans text-xs text-slate-500 truncate">{product.pid}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-sans font-medium text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave(localSelection);
              onClose();
            }}
            className="px-5 py-2 bg-dark-red text-white text-sm font-sans font-medium rounded-lg hover:bg-ruby-red transition-colors shadow-sm"
          >
            Apply Selection
          </button>
        </div>
      </div>
    </div>
  );
}
