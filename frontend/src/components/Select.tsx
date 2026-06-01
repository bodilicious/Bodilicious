import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Select an option',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options.find((opt) => opt.value.toString() === value.toString());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left p-3 bg-white border rounded transition-all duration-300 outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-dark-red/50'
        } ${
          isOpen
            ? 'border-dark-red/50 ring-1 ring-dark-red/30'
            : 'border-silk'
        }`}
      >
        <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-dark-red font-sans'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none flex items-center pr-1 text-gray-400">
          <ChevronDown
            size={16}
            className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-ruby-red' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-50 w-full mt-1 bg-white border border-silk shadow-lg max-h-60 rounded overflow-auto origin-top focus:outline-none"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#E2E8F0 transparent'
            }}
          >
            <ul className="py-1">
              {options.length === 0 ? (
                <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-500 font-sans text-sm">
                  No options
                </li>
              ) : (
                options.map((option, index) => {
                  const isSelected = value === option.value || value?.toString() === option.value?.toString();
                  return (
                    <li
                      key={index}
                      className={`relative cursor-pointer select-none py-2.5 pl-4 pr-9 font-sans text-sm transition-colors duration-150 ${
                        isSelected ? 'bg-ruby-red/5 text-ruby-red font-medium' : 'text-dark-red hover:bg-neutral-50 hover:text-ruby-red'
                      }`}
                      onClick={() => handleSelect(option.value)}
                    >
                      <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                        {option.label}
                      </span>
                      {isSelected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ruby-red">
                          <Check size={16} aria-hidden="true" />
                        </span>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
