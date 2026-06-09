import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function LaunchModal() {
  const { storeSettings } = useApp();
  const modal = storeSettings.launchModal;

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only show if admin has enabled it
    if (!modal?.isActive) return;
    
    // Timer to delay the popup slightly after load
    const timer = setTimeout(() => setIsOpen(true), 2500);
    return () => clearTimeout(timer);
  }, [modal?.isActive]);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Don't render at all if disabled
  if (!modal?.isActive) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 z-10"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-dark-red hover:bg-rose-50 transition-colors shadow-sm cursor-pointer"
              aria-label="Close announcement"
            >
              <X size={16} />
            </button>

            {/* Graphic / Image Area */}
            <div className="h-48 w-full relative bg-gradient-to-br from-rose-100 via-rose-50 to-white flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent opacity-80" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -right-12 -top-12 w-48 h-48 bg-ruby-red/10 rounded-full blur-3xl pointer-events-none"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute -left-12 -bottom-12 w-48 h-48 bg-rose-200/20 rounded-full blur-3xl pointer-events-none"
              />

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="relative z-10 text-center w-full px-6"
              >
                {modal.image ? (
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img
                      src={modal.image}
                      alt={modal.title}
                      className="w-full h-32 object-contain mx-auto drop-shadow-2xl"
                    />
                  </motion.div>
                ) : (
                  <div className="relative">
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-16 h-24 mx-auto bg-gradient-to-b from-rose-200 to-rose-300 rounded-lg shadow-lg border border-white/80 flex items-center justify-center relative z-10"
                    >
                      <Sparkles className="text-ruby-red opacity-60" size={20} />
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 opacity-40">
                        <div className="w-1 h-3 border border-dark-red rounded-sm" />
                        <div className="w-1 h-3 border border-dark-red rounded-sm" />
                      </div>
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 0.8, 1], opacity: [0.5, 0.3, 0.5] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-12 h-2 bg-dark-red/20 rounded-[100%] mx-auto mt-4 blur-[2px]"
                    />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Content */}
            <div className="p-8 text-center bg-white">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-[10px] font-sans font-bold tracking-widest uppercase text-ruby-red mb-4">
                  <Sparkles size={12} />
                  {modal.badge}
                </div>
                <h3 className="text-3xl font-serif text-dark-red mb-3 leading-tight">
                  {modal.title}
                </h3>
                <p className="text-sm font-sans text-grey-beige font-light leading-relaxed mb-8">
                  {modal.description}
                </p>

                <Link
                  to={modal.ctaLink || '/shop'}
                  onClick={handleClose}
                  className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-dark-red to-ruby-red hover:from-ruby-red hover:to-dark-red text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  {modal.ctaLabel}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
