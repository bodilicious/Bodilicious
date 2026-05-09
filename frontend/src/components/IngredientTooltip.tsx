import { useState, useRef, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { getIngredientData } from '../data/ingredientMeta';

interface IngredientTooltipProps {
  name: string;
  className?: string;
}

export default function IngredientTooltip({ name, className = '' }: IngredientTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const data = getIngredientData(name);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Accessibility: Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleTooltip = () => setIsOpen(!isOpen);

  return (
    <div 
      className={`relative inline-block ${className}`} 
      ref={containerRef}
      onMouseEnter={() => !('ontouchstart' in window) && setIsOpen(true)}
      onMouseLeave={() => !('ontouchstart' in window) && setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleTooltip();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTooltip();
          }
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="text-inherit hover:text-ruby-red transition-colors cursor-help border-b border-dotted border-silk-dark/40 hover:border-ruby-red focus:outline-none focus:ring-1 focus:ring-ruby-red/50 rounded-sm"
      >
        {name}
      </button>

      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-white border border-silk/20 shadow-2xl z-[100] rounded-sm pointer-events-auto"
            role="tooltip"
          >
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-silk/20 rotate-45 -mt-1.5 shadow-sm" />
            
            <div className="relative">
              {data.imagePath && (
                <div className="w-full h-32 mb-3 overflow-hidden bg-silk-light/30 rounded-sm">
                  <img 
                    src={data.imagePath} 
                    alt={data.altText} 
                    className="w-full h-full object-cover mix-blend-multiply"
                  />
                </div>
              )}
              <h4 className="text-[11px] font-sans font-bold uppercase tracking-wider text-dark-red mb-1">
                {data.name}
              </h4>
              <p className="text-[11px] font-sans leading-relaxed text-grey-beige italic mb-2">
                &quot;{data.description}&quot;
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-ruby-red" />
                <span className="text-[9px] font-sans uppercase tracking-widest text-ruby-red font-bold">
                  Clinical Efficacy
                </span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
