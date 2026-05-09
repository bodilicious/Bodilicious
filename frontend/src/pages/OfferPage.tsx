/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApp } from '../context/AppContext';
import { Sparkles, ShoppingBag, Gift, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';

export default function OfferPage() {
  const { user, authStatus, navigateTo } = useApp();

  const welcomeOffer = (user as any)?.welcomeOffer;
  const isEligible = welcomeOffer?.eligible === true;
  const isAuthenticated = authStatus === 'authenticated';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } }
  };

  return (
    <main className="min-h-screen bg-[#F8F4EF] flex flex-col selection:bg-ruby-red/10">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#3E2C23] py-24 px-6 text-white text-center">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=2000')] bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#3E2C23]/80" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative max-w-2xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 text-[10px] font-sans font-bold tracking-[0.2em] uppercase text-silk mb-8">
            <Sparkles size={12} className="text-silk animate-pulse" />
            Limited Time Welcome Gift
          </span>

          <h1 className="font-serif text-5xl md:text-6xl mb-6 leading-tight">
            The Welcome Ritual
          </h1>
          <p className="text-silk/80 text-lg md:text-xl font-light font-sans leading-relaxed mb-4 max-w-lg mx-auto">
            Experience the Bodilicious difference with <span className="text-white font-medium">10% OFF</span> your first intentional skincare purchase.
          </p>
          <div className="h-px w-24 bg-silk/30 mx-auto my-8" />
        </motion.div>
      </section>

      {/* Status card */}
      <section className="max-w-4xl mx-auto w-full px-6 -mt-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {!isAuthenticated ? (
            <div className="bg-white rounded-3xl shadow-luxury border border-silk p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-silk-light flex items-center justify-center">
                <Clock size={28} className="text-grey-beige" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="font-serif text-dark text-2xl mb-2 text-dark-red">Personalize Your Offer</p>
                <p className="font-sans text-grey-beige text-sm leading-relaxed max-w-md">Sign in to confirm your eligibility and unlock your personalized welcome ritual benefits.</p>
              </div>
              <button
                onClick={() => navigateTo('signin')}
                className="flex-shrink-0 bg-dark text-white px-8 py-4 rounded-2xl text-xs font-sans font-bold tracking-widest uppercase hover:bg-ruby-red transition-all shadow-lg hover:scale-[1.02]"
              >
                Continue to Login
              </button>
            </div>
          ) : isEligible ? (
            <div className="bg-white rounded-3xl shadow-luxury border border-[#E8D5C8] p-8 flex flex-col md:flex-row items-center gap-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-silk/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-[#F4EBE4] flex items-center justify-center">
                <CheckCircle size={28} className="text-ruby-red" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="font-serif text-dark text-2xl mb-2 text-dark-red">Your gift is waiting</p>
                <p className="font-sans text-grey-beige text-sm leading-relaxed max-w-md">The 10% welcome discount is active and will be applied automatically to your first ritual at checkout.</p>
              </div>
              <button
                onClick={() => navigateTo('shop')}
                className="flex-shrink-0 bg-ruby-red text-white px-8 py-4 rounded-2xl text-xs font-sans font-bold tracking-widest uppercase hover:bg-dark transition-all shadow-lg hover:scale-[1.02] flex items-center gap-3"
              >
                <ShoppingBag size={16} />
                Build Your Ritual
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-luxury border border-silk p-8 flex flex-col md:flex-row items-center gap-6 grayscale opacity-80">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-silk-light flex items-center justify-center">
                <XCircle size={28} className="text-grey-beige" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="font-serif text-dark text-2xl mb-2">Offer Realized</p>
                <p className="font-sans text-grey-beige text-sm leading-relaxed max-w-md">You've already embarked on your Bodilicious journey. Explore our collections for more intentional beauty.</p>
              </div>
              <button
                onClick={() => navigateTo('shop')}
                className="flex-shrink-0 border border-silk text-dark px-8 py-4 rounded-2xl text-xs font-sans font-bold tracking-widest uppercase hover:bg-silk-light transition-all"
              >
                Back to Collections
              </button>
            </div>
          )}
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto w-full px-6 py-24">
        <div className="text-center mb-16">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-ruby-red font-bold mb-4">Journey to Radiance</p>
          <h2 className="font-serif text-4xl text-dark mb-4">The Experience</h2>
          <div className="h-px w-16 bg-ruby-red/20 mx-auto" />
        </div>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-10"
        >
          {[
            {
              icon: '✦',
              step: '01',
              title: 'Curated Discovery',
              desc: 'Select from our range of meticulously crafted clinical and botanical solutions.',
            },
            {
              icon: '✦',
              step: '02',
              title: 'Seamless Blessing',
              desc: 'Your welcome gift follows you to checkout. No codes, just grace.',
            },
            {
              icon: '✦',
              step: '03',
              title: 'Sensory Delivery',
              desc: 'Begin your transformation as premium beauty arrives at your doorstep.',
            },
          ].map(({ icon, step, title, desc }) => (
            <motion.div
              key={step}
              variants={itemVariants}
              className="relative group p-8 rounded-3xl bg-white/50 border border-silk hover:bg-white hover:shadow-luxury transition-all duration-500"
            >
              <span className="absolute top-6 right-8 text-[10px] font-sans font-bold text-silk group-hover:text-ruby-red transition-colors">{step}</span>
              <div className="text-3xl text-ruby-red mb-6 font-serif">{icon}</div>
              <h3 className="font-serif text-xl text-dark mb-4 group-hover:text-dark-red transition-colors">{title}</h3>
              <p className="font-sans text-grey-beige text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Terms */}
      <section className="max-w-4xl mx-auto w-full px-6 pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-[#F4EBE4]/50 rounded-3xl p-10 border border-[#E8D5C8]"
        >
          <div className="flex items-center gap-3 mb-8">
            <Gift size={20} className="text-ruby-red" />
            <h2 className="font-serif text-2xl text-dark">Ritual Specifics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {[
              'Exclusive to your first Bodilicious collection purchase.',
              'Value of 10% discount applied automatically at checkout.',
              'No expiration—expires only upon first successful order.',
              'Offer remains active if preliminary orders are cancelled.',
              'Independent of other ongoing brand promotions.',
              'Designed for one unique beautiful soul per account.',
            ].map((term, i) => (
              <div key={i} className="flex items-start gap-4">
                <ChevronRight size={14} className="text-ruby-red mt-1 shrink-0" />
                <p className="font-sans text-sm text-grey-beige leading-relaxed">{term}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
      
      <Footer />
    </main>
  );
}
