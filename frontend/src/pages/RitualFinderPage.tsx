import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, CheckCircle2, Sun, Moon, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, Page } from '../types';
import toast from 'react-hot-toast';
import { useSEO } from '../hooks/useSEO';

import {
    FocusArea, SkinType, Concern, Goal, QuizState, RoutineTime,
    scoreProduct, AREA_MAP, PRESET_ROUTINES
} from '../utils/ritualLogic';

interface RoutineStep {
    title: string;
    stepLabel: string;
    product: Product;
    reason: string;
    icon: string;
}

const FOCUS_AREAS: FocusArea[] = ['Face', 'Body', 'Hair', 'Everything'];
const SKIN_TYPES: SkinType[] = ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'];

const CONCERNS_MAP: Record<FocusArea, Concern[]> = {
    'Face': ['Acne', 'Dark spots', 'Pigmentation', 'Dullness', 'Dryness', 'Aging / fine lines', 'Uneven skin tone'],
    'Body': ['Body acne', 'Stretch marks', 'Rough texture', 'Uneven body tone'],
    'Hair': ['Dandruff', 'Hair fall', 'Frizzy hair', 'Split ends'],
    'Everything': ['Acne', 'Dark spots', 'Aging / fine lines', 'Body acne', 'Hair fall', 'Dandruff'],
    '': []
};

const GOALS_MAP: Record<FocusArea, Goal[]> = {
    'Face': ['Hydration', 'Brightening', 'Oil control', 'Repair & nourishment', 'Anti-aging'],
    'Body': ['Smooth skin', 'Firming', 'Soothing'],
    'Hair': ['Scalp health', 'Growth', 'Shine'],
    'Everything': ['Hydration', 'Brightening', 'Smooth skin', 'Scalp health'],
    '': []
};

const ROUTINE_TIMES: RoutineTime[] = ['Morning routine', 'Night routine', 'Full skincare routine'];

const STEP_ICONS: Record<string, string> = {
    'Cleanse': '🫧',
    'Balance & Soothe': '🌿',
    'Treat': '💧',
    'Eye Care': '👁️',
    'Nourish': '🧴',
    'Moisturize': '🧴',
    'Protect': '☀️',
    'Lip Care': '💋',
    'Body Wash': '🚿',
    'Body Lotion': '🧴',
    'Scalp Care': '💆',
    'Shampoo': '🧼',
    'Hair Oil': '🌿',
};

const COMBO_DISCOUNT_PERCENT = 10;

const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
};

const stepCardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.18, duration: 0.5, ease: 'easeOut' as any }
    })
};

// ─── Pro Tips per step type ───────────────────────────────────────────────────
const PRO_TIPS: Record<string, string> = {
    'Cleanse': 'Lukewarm water only — heat strips your natural oils. Massage for 60 seconds in gentle circular motions.',
    'Treat': 'Pat, never rub. Apply to slightly damp skin for 30% deeper absorption. One pump is plenty.',
    'Moisturize': "Apply within 60 seconds of cleansing to seal moisture in. Press, don't swipe.",
    'Protect': 'Last step, always. Use a full ¼ tsp for face and neck. Reapply every 2 hours in direct sun.',
    'Body Wash': "Use a silicone brush or loofah for gentle exfoliation. Pat dry — never rub — to keep skin plump.",
    'Body Lotion': 'Apply within 3 minutes of showering on still-damp skin. The moisture boost is 3× higher.',
    'Hair Oil': 'Warm 3–5 drops between palms before applying. Minimum 30 mins before washing for deep conditioning.',
    'Shampoo': 'Massage scalp firmly for 2 minutes before rinsing. Focus product at the root, not the ends.',
    'Scalp Care': 'Section hair for even coverage. Use fingertip pads — not nails — to stimulate blood flow.',
    'Lip Care': 'Exfoliate gently first. Apply over serum for 3× hydration lock.',
    'Balance & Soothe': 'Press with clean palms — never a cotton pad — to avoid micro-irritation.',
    'Eye Care': 'Ring finger only — it has the least natural pressure. Tap outward from inner corner.',
    'Nourish': 'Thin layers allow each to fully absorb. Wait 30 seconds between layers.',
};

// ─── HowToUseCarousel Component ───────────────────────────────────────────────
interface HowToUseCarouselProps {
    recommendedRoutine: { title: string; stepLabel: string; product: any; reason: string; icon: string }[];
    navigateTo: (page: Page, id?: string) => void;
    routineTime: string;
}

function HowToUseCarousel({ recommendedRoutine, navigateTo, routineTime }: HowToUseCarouselProps) {
    const [active, setActive] = useState(0);
    const total = recommendedRoutine.length;

    const goTo = (idx: number) => setActive(Math.max(0, Math.min(total - 1, idx)));

    const getInstructions = (item: typeof recommendedRoutine[0]): string[] => {
        if (item.product.how_to_use && item.product.how_to_use.length > 0) {
            return item.product.how_to_use.slice(0, 3);
        }
        return [item.product.description?.split('.')[0] + '.' || item.reason];
    };

    const getTags = (item: typeof recommendedRoutine[0]): string[] => {
        const tags: string[] = [];
        if (item.product.usage?.time) tags.push(item.product.usage.time);
        if (item.product.usage?.frequency) tags.push(item.product.usage.frequency);
        if (item.product.usage?.routine_step) tags.push(item.product.usage.routine_step);
        if (tags.length === 0) tags.push(routineTime === 'Morning routine' ? 'AM' : routineTime === 'Night routine' ? 'PM' : 'AM & PM');
        return tags;
    };

    if (total === 0) return null;

    const current = recommendedRoutine[active];
    const instructions = getInstructions(current);
    const tags = getTags(current);
    const tip = PRO_TIPS[current.stepLabel] || 'Apply with clean hands. Allow 30–60 seconds to fully absorb before the next step.';

    return (
        <div className="mt-24 pt-16 border-t border-[#D5C9BE]">

            {/* ── Section Header ── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="text-center mb-12"
            >
                <span className="inline-flex items-center gap-3 font-sans text-[10px] font-bold uppercase tracking-[0.3em] text-[#A89080] mb-4">
                    <span className="w-8 h-px bg-gradient-to-r from-transparent to-[#C4B0A3]" />
                    Your Ritual Guide
                    <span className="w-8 h-px bg-gradient-to-l from-transparent to-[#C4B0A3]" />
                </span>
                <h2 className="font-serif text-5xl sm:text-6xl italic text-dark-red tracking-tight leading-none mb-3">
                    How to use it.
                </h2>
                <p className="font-sans text-sm text-[#A89080] max-w-xs mx-auto leading-relaxed">
                    Apply in order — the sequence maximises each product's efficacy.
                </p>
            </motion.div>

            {/* ── Step Pills (top nav) ── */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="flex items-center justify-center gap-2 mb-10 flex-wrap"
            >
                {recommendedRoutine.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        aria-label={`Step ${idx + 1}: ${item.stepLabel}`}
                        className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-sans font-semibold tracking-wide transition-all duration-300 cursor-pointer
                            ${active === idx
                                ? 'bg-dark-red border-dark-red text-white shadow-md'
                                : 'bg-white/60 border-[#D5C9BE] text-[#A89080] hover:border-dark-red hover:text-dark-red'
                            }`}
                    >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                            ${active === idx ? 'bg-white/20 text-white' : 'bg-[#F0E8E2] text-[#A89080] group-hover:bg-rose-50 group-hover:text-dark-red'}`}
                        >
                            {idx + 1}
                        </span>
                        <span className="hidden sm:block">{item.stepLabel}</span>
                    </button>
                ))}
            </motion.div>

            {/* ── Main Card Area ── */}
            <div className="relative">

                {/* Desktop outer arrows */}
                <button
                    onClick={() => goTo(active - 1)}
                    disabled={active === 0}
                    aria-label="Previous step"
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-20 hidden lg:flex w-10 h-10 items-center justify-center rounded-full bg-white border border-[#D5C9BE] shadow-md hover:border-dark-red hover:shadow-lg transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronLeft size={18} className="text-dark-red" />
                </button>
                <button
                    onClick={() => goTo(active + 1)}
                    disabled={active === total - 1}
                    aria-label="Next step"
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-20 hidden lg:flex w-10 h-10 items-center justify-center rounded-full bg-white border border-[#D5C9BE] shadow-md hover:border-dark-red hover:shadow-lg transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                >
                    <ChevronRight size={18} className="text-dark-red" />
                </button>

                {/* ── Desktop: Horizontal Carousel Card ── */}
                <div className="hidden lg:block">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`desktop-${active}`}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                            className="grid grid-cols-12 gap-0 rounded-3xl overflow-hidden border border-[#E0D5CC] bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
                        >
                            {/* Left panel — product visual */}
                            <div className="col-span-4 bg-gradient-to-br from-[#F5EFE9] via-[#EFE7DF] to-[#E8DDD5] flex flex-col items-center justify-center p-10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/30 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#D5C9BE]/40 rounded-full blur-2xl pointer-events-none" />
                                <span className="absolute top-6 left-7 font-serif text-[5rem] leading-none font-bold text-dark-red/[0.06] select-none pointer-events-none">
                                    {String(active + 1).padStart(2, '0')}
                                </span>
                                <div className="relative w-44 h-44 flex items-center justify-center mb-6">
                                    <div className="absolute inset-0 bg-white/50 rounded-full blur-xl" />
                                    <img
                                        src={current.product.images[0]}
                                        alt={current.product.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="relative w-full h-full object-contain mix-blend-multiply drop-shadow-md"
                                    />
                                </div>
                                <span className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-[#A89080] mb-2">
                                    Step {active + 1} of {total}
                                </span>
                                <span className="font-sans text-xs font-semibold text-dark-red bg-white/70 border border-[#D5C9BE] rounded-full px-4 py-1.5 tracking-wide">
                                    {current.stepLabel}
                                </span>
                                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                                    {tags.map((tag, ti) => (
                                        <span key={ti} className="font-sans text-[10px] text-[#6B4E3D] bg-white/60 border border-[#D5C9BE] rounded-full px-2.5 py-0.5">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Right panel — instructions */}
                            <div className="col-span-8 p-10 flex flex-col justify-between">
                                <div className="space-y-7">
                                    <div>
                                        <button
                                            onClick={() => navigateTo('product', current.product.pid)}
                                            className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[#A89080] hover:text-dark-red transition-colors duration-200 mb-2 block cursor-pointer"
                                        >
                                            {current.product.name} →
                                        </button>
                                        <h3 className="font-serif text-3xl text-dark-red leading-tight">{current.stepLabel}</h3>
                                        <p className="font-sans text-sm text-[#A89080] italic mt-1 leading-relaxed">"{current.reason}"</p>
                                    </div>

                                    <div>
                                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-[#A89080] mb-3">How to Apply</p>
                                        <ul className="space-y-3">
                                            {instructions.map((inst: string, i: number) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-dark-red/40 mt-2"></span>
                                                    <span className="font-sans text-[15px] text-[#3D2B1F] leading-relaxed">{inst}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex items-start gap-3.5 bg-gradient-to-r from-[#FBF7F4] to-[#F5EFE9] border border-[#E8DDD5] rounded-2xl p-5">
                                        <div className="w-7 h-7 rounded-xl bg-dark-red flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                            <Sparkles size={12} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-dark-red mb-1">Pro Tip</p>
                                            <p className="font-sans text-sm text-[#5C4033] leading-relaxed">{tip}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom nav bar */}
                                <div className="flex items-center justify-between pt-7 border-t border-[#EDE5DE] mt-7">
                                    <button
                                        onClick={() => goTo(active - 1)}
                                        disabled={active === 0}
                                        className="inline-flex items-center gap-2 font-sans text-xs font-semibold text-[#A89080] hover:text-dark-red transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <ChevronLeft size={15} /> Prev
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        {recommendedRoutine.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => goTo(idx)}
                                                aria-label={`Go to step ${idx + 1}`}
                                                className={`rounded-full transition-all duration-300 cursor-pointer ${active === idx ? 'w-6 h-2 bg-dark-red' : 'w-2 h-2 bg-[#D5C9BE] hover:bg-[#A89080]'}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => goTo(active + 1)}
                                        disabled={active === total - 1}
                                        className="inline-flex items-center gap-2 font-sans text-xs font-semibold text-[#A89080] hover:text-dark-red transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Next <ChevronRight size={15} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── Mobile: Vertical Stacked Cards ── */}
                <div className="lg:hidden space-y-5">
                    {recommendedRoutine.map((item, idx) => {
                        const insts = getInstructions(item);
                        const itemTags = getTags(item);
                        const itemTip = PRO_TIPS[item.stepLabel] || 'Apply with clean hands. Allow 30–60 seconds to fully absorb.';
                        return (
                            <motion.div
                                key={`mob-${item.product.pid}`}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                className="rounded-2xl border border-[#E0D5CC] bg-white/70 backdrop-blur-sm overflow-hidden shadow-sm"
                            >
                                <div className="flex items-center gap-4 p-4 pb-3 border-b border-[#EDE5DE]">
                                    <div className="w-14 h-14 rounded-xl bg-[#F5EFE9] flex items-center justify-center shrink-0 overflow-hidden">
                                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-contain mix-blend-multiply p-1" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-[#A89080] block">{item.stepLabel}</span>
                                        <button onClick={() => navigateTo('product', item.product.pid)} className="font-serif text-[15px] text-dark-red hover:text-ruby-red transition-colors leading-snug text-left cursor-pointer block w-full truncate">
                                            {item.product.name}
                                        </button>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {itemTags.map((t, ti) => (
                                                <span key={ti} className="font-sans text-[10px] text-[#6B4E3D] bg-[#F2EBE4] border border-[#D5C9BE] rounded-full px-2 py-0.5">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <span className="font-sans text-[10px] font-bold text-[#C4B0A3] shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    <ul className="space-y-2">
                                        {insts.map((inst: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span className="w-1 h-1 rounded-full bg-[#C4B0A3] shrink-0 mt-2"></span>
                                                <span className="font-sans text-sm text-[#3D2B1F] leading-relaxed">{inst}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex items-start gap-2.5 bg-[#FBF7F4] border border-[#E8DDD5] rounded-xl p-3">
                                        <div className="w-5 h-5 rounded-full bg-dark-red flex items-center justify-center shrink-0 mt-0.5">
                                            <Sparkles size={9} className="text-white" />
                                        </div>
                                        <p className="font-sans text-[11px] text-[#5C4033] leading-relaxed">{itemTip}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* ── Golden Rules Footer ── */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mt-12 rounded-2xl bg-dark-red/[0.04] border border-[#D5C9BE] p-6"
            >
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-[#A89080] mb-5 text-center">Golden Rules</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                        { icon: <RefreshCcw size={13} className="text-dark-red" />, title: 'Be Consistent', desc: 'Use daily for 4–6 weeks minimum. Consistency beats intensity.' },
                        { icon: <CheckCircle2 size={13} className="text-dark-red" />, title: 'Patch Test First', desc: 'New active? Try your inner wrist 24 hrs before face application.' },
                        { icon: <ArrowRight size={13} className="text-dark-red" />, title: 'Follow the Order', desc: 'Thinnest to thickest — water-based before oils, always.' },
                    ].map((rule) => (
                        <div key={rule.title} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-xl bg-white border border-[#D5C9BE] flex items-center justify-center shrink-0 shadow-sm">
                                {rule.icon}
                            </div>
                            <div>
                                <p className="font-sans text-[11px] font-bold text-dark-red mb-0.5">{rule.title}</p>
                                <p className="font-sans text-[11px] text-[#A89080] leading-relaxed">{rule.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

        </div>
    );
}

export default function RitualFinderPage() {

    const { products, user, navigateTo, addToCart, updateUserProfile, authStatus, getAuthHeaders } = useApp();

    useSEO({
        title: 'Skincare Ritual Finder — Bodilicious',
        description:
            'Answer a few questions and get a personalized Bodilicious skincare or haircare routine for your needs.',
        keywords: 'bodilicious, skincare, haircare, natural beauty, products, buy online',
        canonical: '/ritual-finder',
    });

    const [step, setStep] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [answers, setAnswers] = useState<QuizState>({
        focusArea: '',
        skinType: '',
        concerns: [],
        goal: '',
        routineTime: '',
    });

    const logRitualEvent = async (status: string, currentAnswers?: QuizState) => {
        try {
            const data = {
                status,
                skinType: currentAnswers?.skinType || answers.skinType,
                concerns: currentAnswers?.concerns || answers.concerns,
                goals: currentAnswers?.goal ? [currentAnswers.goal] : (answers.goal ? [answers.goal] : []),
                focusArea: currentAnswers?.focusArea || answers.focusArea,
                routineTime: currentAnswers?.routineTime || answers.routineTime,
            };
            const headers = await getAuthHeaders();
            fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/chat/ritual-event`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(() => { }); // Fire and forget
        } catch { /* fail silently */ }
    };

    useEffect(() => {
        if (authStatus === 'authenticated' && user && step === 0) {
            setAnswers(prev => ({
                ...prev,
                skinType: (user.skinType as SkinType) || prev.skinType,
                // We keep the rest blank to encourage fresh assessment for new scenarios
                routineTime: (user.preferredRoutine === 'Morning Routine' ? 'Morning routine' :
                    user.preferredRoutine === 'Night Routine' ? 'Night routine' :
                        user.preferredRoutine === 'Both' ? 'Full skincare routine' : '') as RoutineTime
            }));
        }
    }, [authStatus, user, step]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [step]);

    const handleNext = () => {
        if (step === 0) logRitualEvent('started');
        // Skip Skin Type if not focusing on Face or Everything
        if (step === 1 && (answers.focusArea === 'Body' || answers.focusArea === 'Hair')) {
            setStep(3); // Go to Concerns
            return;
        }
        if (step < 6 && !isTransitioning) setStep(s => s + 1);
    };

    const handleBack = () => {
        if (step === 3 && (answers.focusArea === 'Body' || answers.focusArea === 'Hair')) {
            setStep(1); // Go back to Focus Area
            return;
        }
        if (step > 0 && !isTransitioning) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsTransitioning(false);
            setStep(s => s - 1);
        }
    };

    const toggleConcern = (concern: Concern) => {
        if (isTransitioning) return;
        setAnswers(prev => ({
            ...prev,
            concerns: prev.concerns.includes(concern)
                ? prev.concerns.filter(c => c !== concern)
                : [...prev.concerns, concern],
        }));
    };


    const selectSingleOption = (key: keyof QuizState, value: string) => {
        if (isTransitioning) return;
        setAnswers(prev => ({ ...prev, [key]: value }));
        setIsTransitioning(true);
        timeoutRef.current = setTimeout(() => {
            setIsTransitioning(false);
            if (key === 'routineTime') {
                logRitualEvent('completed');
                submitQuiz();
            }
            else handleNext();
        }, 400);
    };

    const submitQuiz = async () => {
        setStep(6); // Analyzing

        if (authStatus === 'authenticated' && user) {
            try {
                // Only sync face info to profile for now, as profile schema is limited
                if (answers.focusArea === 'Face' || answers.focusArea === 'Everything') {
                    await updateUserProfile({
                        skinType: answers.skinType as any,
                        skinConcerns: answers.concerns as any,
                        preferredRoutine: answers.routineTime === 'Morning routine' ? 'Morning Routine' :
                            answers.routineTime === 'Night routine' ? 'Night Routine' : 'Both'
                    });
                }
                setTimeout(() => {
                    logRitualEvent('viewed_recommendations');
                    setStep(7); // Results
                }, 1500);
            } catch (err) {
                console.error("Failed to sync ritual to profile:", err);
                setStep(7);
            }
        } else {
            setTimeout(() => {
                setStep(7);
            }, 2500);
        }
    };

    const recommendedRoutine = useMemo<RoutineStep[]>(() => {
        if (step !== 7) return [];

        const { focusArea, routineTime } = answers;
        const isMorning = routineTime === 'Morning routine' || routineTime === 'Full skincare routine';
        const isNight = routineTime === 'Night routine' || routineTime === 'Full skincare routine';

        // Check if answers match any preset routine
        const matchingPreset = PRESET_ROUTINES.find(preset => preset.condition(answers));

        if (matchingPreset && (focusArea === 'Face' || focusArea === 'Everything')) {
            const steps: RoutineStep[] = [];
            const addPresetSteps = (presetSteps: typeof matchingPreset.morning) => {
                presetSteps.forEach(ps => {
                    const product = products.find(p => p.pid === ps.pid);
                    if (product && !steps.some(s => s.product.pid === product.pid)) {
                        steps.push({
                            title: ps.stepLabel,
                            stepLabel: ps.stepLabel,
                            product,
                            reason: ps.reason,
                            icon: ps.icon
                        });
                    }
                });
            };

            if (isMorning) {
                addPresetSteps(matchingPreset.morning);
            }
            if (isNight) {
                addPresetSteps(matchingPreset.night);
            }
            if (matchingPreset.weekly && (isNight || !isMorning)) {
                // Add weekly treatments generally to the night/full routine
                addPresetSteps(matchingPreset.weekly);
            }

            // If we found products, return this predefined routine
            if (steps.length > 0) return steps;
        }

        // Fallback to dynamic scoring if no preset matches or no products found
        const usedPids = new Set<string>();
        const getBest = (subCats: string[], reason: string, stepLabel: string): RoutineStep | null => {
            let candidates = products.filter(
                p => subCats.includes(p.sub_category || '') && !usedPids.has(p.pid)
            ).map(p => ({ product: p, score: scoreProduct(p, answers) }))
                .filter(item => item.score >= 0);

            if (!candidates.length) {
                const areaCats = AREA_MAP[answers.focusArea] || [];
                candidates = products.filter(
                    p => areaCats.includes(p.category) && !usedPids.has(p.pid)
                ).map(p => ({ product: p, score: scoreProduct(p, answers) }))
                    .filter(item => item.score >= 0);
            }

            if (!candidates.length) return null;

            const best = candidates.sort((a, b) => b.score - a.score || (b.product.rating - a.product.rating))[0];
            usedPids.add(best.product.pid);

            return {
                title: stepLabel,
                stepLabel,
                product: best.product,
                reason: reason || best.product.benefits?.[0] || 'Perfect match for your profile.',
                icon: STEP_ICONS[stepLabel] || '✨'
            };
        };

        const steps: RoutineStep[] = [];

        if (focusArea === 'Face' || focusArea === 'Everything') {
            const cleanser = getBest(['cleanser', 'face wash', 'face_body_wash'], 'Purifies your skin without stripping essential moisture.', 'Cleanse');
            if (cleanser) steps.push(cleanser);

            const treat = getBest(['serum'], 'Delivers potent active ingredients directly targeting your concerns.', 'Treat');
            if (treat) steps.push(treat);

            const moist = getBest(['moisturizer', 'cream', 'night_cream'], 'Locks in hydration and repairs the skin barrier.', 'Moisturize');
            if (moist) steps.push(moist);

            if (isMorning) {
                const sun = getBest(['sunscreen'], 'Crucial shield against UV damage.', 'Protect');
                if (sun) steps.push(sun);
            }
        }

        if (focusArea === 'Body' || focusArea === 'Everything') {
            const wash = getBest(['face_body_wash', 'soap'], 'Gentle cleansing for your body.', 'Body Wash');
            if (wash) steps.push(wash);
        }

        if (focusArea === 'Hair' || focusArea === 'Everything') {
            const oil = getBest(['hair_oil'], 'Nourishes the scalp and strengthens hair roots.', 'Hair Oil');
            if (oil) steps.push(oil);

            const sham = getBest(['shampoo'], 'Cleanses while maintaining moisture balance.', 'Shampoo');
            if (sham) steps.push(sham);

            const hairSerum = getBest(['hair_serum', 'scalp_treatment'], 'Targeted treatment for hair texture and growth.', 'Scalp Care');
            if (hairSerum) steps.push(hairSerum);
        }

        if (focusArea === 'Face' || focusArea === 'Everything') {
            const lip = getBest(['lip_balm'], 'Keeps lips hydrated and protected.', 'Lip Care');
            if (lip) steps.push(lip);
        }

        return steps;
    }, [answers, products, step]);

    const totalPrice = useMemo(() => recommendedRoutine.reduce((s, r) => s + (r.product.price || 0), 0), [recommendedRoutine]);
    const comboPrice = useMemo(() => Math.round(totalPrice * (1 - COMBO_DISCOUNT_PERCENT / 100)), [totalPrice]);

    const handleAddFullRitual = () => {
        logRitualEvent('placed_order'); // Event though it is just add to cart, it marks intent
        recommendedRoutine.forEach((r, idx) => {
            const isLast = idx === recommendedRoutine.length - 1;
            const defaultVariant = r.product.variants && r.product.variants.length > 0 ? r.product.variants[0] : null;
            addToCart(r.product, 1, !isLast, defaultVariant);
        });
        toast.success(`✨ ${recommendedRoutine.length} products added to your bag!`);
    };

    const canProceed = () => {
        if (isTransitioning) return false;
        switch (step) {
            case 1: return answers.focusArea !== '';
            case 2: return answers.skinType !== '';
            case 3: return answers.concerns.length > 0;
            case 4: return answers.goal !== '';
            case 5: return answers.routineTime !== '';
            default: return true;
        }
    };

    const renderProgressBar = () => {
        if (step === 0 || step >= 6) return null;
        const totalSteps = 5;
        const progress = (step / totalSteps) * 100;
        return (
            <div className="w-full max-w-md mx-auto mb-8">
                <div className="flex justify-between text-xs font-sans text-grey-beige mb-2 uppercase tracking-widest">
                    <span>Step {step} of {totalSteps}</span>
                    <span>{Math.round(progress)}% completed</span>
                </div>
                <div className="h-1 bg-silk w-full rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-ruby-red rounded-full"
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen pt-20 bg-[#EFE7DF] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[url('https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply pointer-events-none rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[url('https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply pointer-events-none rounded-tr-full" />

            <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-12 flex flex-col justify-center relative z-10">
                {renderProgressBar()}

                <AnimatePresence mode="wait">

                    {/* ── HERO ── */}
                    {step === 0 && (
                        <motion.div key="hero" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="text-center">
                            <div className="inline-flex items-center justify-center p-4 bg-white/50 rounded-full mb-8 shadow-sm backdrop-blur-sm">
                                <Sparkles className="text-ruby-red" size={28} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-serif text-dark-red mb-6">Find Your Perfect Bodilicious Ritual</h1>
                            <p className="text-lg md:text-xl font-sans text-grey-beige max-w-2xl mx-auto mb-12">
                                For your skin, body, or hair — we'll curate a personalized routine that truly works for you.
                            </p>
                            <button onClick={handleNext} className="inline-flex items-center gap-2 bg-ruby-red text-white px-8 py-4 rounded font-sans tracking-widest uppercase text-sm hover:bg-dark-red transition-all transform hover:scale-105 shadow-md">
                                Start Assessment <ArrowRight size={18} />
                            </button>
                        </motion.div>
                    )}

                    {/* ── STEP 1: FOCUS AREA ── */}
                    {step === 1 && (
                        <motion.div key="step1" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-serif text-dark-red text-center mb-8">Where would you like to focus?</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {FOCUS_AREAS.map(area => (
                                    <button key={area} onClick={() => selectSingleOption('focusArea', area)}
                                        className={`p-6 rounded-2xl border text-center font-serif transition-all duration-300 ${answers.focusArea === area ? 'border-[#8B5E3C] bg-[#8B5E3C]/10 text-dark-red shadow-sm scale-[1.02]' : 'border-white/40 bg-white/40 hover:bg-white/60 text-grey-beige'}`}>
                                        <div className="text-2xl mb-2">
                                            {area === 'Face' ? '🧖‍♀️' : area === 'Body' ? '🚿' : area === 'Hair' ? '💇‍♀️' : '✨'}
                                        </div>
                                        <div className="text-lg">{area}</div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}


                    {/* ── STEP 2: SKIN TYPE (Face/Everything) ── */}
                    {step === 2 && (
                        <motion.div key="step2" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-serif text-dark-red text-center mb-8">What is your skin type?</h2>
                            <div className="flex flex-col gap-4">
                                {SKIN_TYPES.map(type => (
                                    <button key={type} onClick={() => selectSingleOption('skinType', type)}
                                        className={`p-5 rounded-xl border text-left font-sans transition-all duration-300 flex items-center justify-between ${answers.skinType === type ? 'border-[#8B5E3C] bg-[#8B5E3C]/10 text-dark-red shadow-sm' : 'border-white/40 bg-white/40 hover:bg-white/60 text-grey-beige'}`}>
                                        <span className="text-lg">{type}</span>
                                        {answers.skinType === type && <CheckCircle2 className="text-[#8B5E3C]" size={20} />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 3: CONCERNS ── */}
                    {step === 3 && (
                        <motion.div key="step3" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-serif text-dark-red text-center mb-4">What concerns shall we address?</h2>
                            <p className="text-center text-grey-beige font-sans mb-8">Select all that apply for your {answers.focusArea}.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {CONCERNS_MAP[answers.focusArea || 'Face'].map(concern => {
                                    const isSelected = answers.concerns.includes(concern);
                                    return (
                                        <button key={concern} onClick={() => toggleConcern(concern)}
                                            className={`p-4 rounded-xl border text-left font-sans transition-all duration-300 flex items-center justify-between ${isSelected ? 'border-[#8B5E3C] bg-[#8B5E3C]/10 text-dark-red shadow-sm' : 'border-white/40 bg-white/40 hover:bg-white/60 text-grey-beige'}`}>
                                            <span>{concern}</span>
                                            {isSelected && <CheckCircle2 className="text-[#8B5E3C]" size={18} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 4: GOAL ── */}
                    {step === 4 && (
                        <motion.div key="step4" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-serif text-dark-red text-center mb-8">What is your primary goal?</h2>
                            <div className="flex flex-col gap-4">
                                {GOALS_MAP[answers.focusArea || 'Face'].map(goal => (
                                    <button key={goal} onClick={() => selectSingleOption('goal', goal)}
                                        className={`p-5 rounded-xl border text-left font-sans transition-all duration-300 flex items-center justify-between ${answers.goal === goal ? 'border-[#8B5E3C] bg-[#8B5E3C]/10 text-dark-red shadow-sm' : 'border-white/40 bg-white/40 hover:bg-white/60 text-grey-beige'}`}>
                                        <span className="text-lg">{goal}</span>
                                        {answers.goal === goal && <CheckCircle2 className="text-[#8B5E3C]" size={20} />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 5: ROUTINE TYPE ── */}
                    {step === 5 && (
                        <motion.div key="step5" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-2xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-serif text-dark-red text-center mb-8">Your preferred routine?</h2>
                            <div className="flex flex-col gap-4">
                                {ROUTINE_TIMES.map(time => {
                                    const Icon = time.includes('Morning') ? Sun : time.includes('Night') ? Moon : RefreshCcw;
                                    return (
                                        <button key={time} onClick={() => selectSingleOption('routineTime', time)}
                                            className={`p-5 rounded-xl border text-left font-sans transition-all duration-300 flex items-center gap-4 ${answers.routineTime === time ? 'border-ruby-red bg-ruby-red/5 text-dark-red shadow-sm' : 'border-white/40 bg-white/40 hover:bg-white/60 text-grey-beige'}`}>
                                            <span className={`p-2 rounded-full ${answers.routineTime === time ? 'bg-ruby-red text-white' : 'bg-white text-grey-beige'}`}><Icon size={20} /></span>
                                            <span className="text-lg flex-1">{time}</span>
                                            {answers.routineTime === time && <CheckCircle2 className="text-ruby-red" size={20} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}


                    {/* ── ANALYZING ── */}
                    {step === 6 && (
                        <motion.div key="analyzing" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full text-center py-20">
                            <div className="relative w-24 h-24 mx-auto mb-8 flex justify-center items-center">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 border-4 border-[#8B5E3C]/20 border-t-[#8B5E3C] rounded-full" />
                                <Sparkles className="text-[#8B5E3C]" size={32} />
                            </div>
                            <h2 className="text-2xl font-serif text-dark-red mb-2">Curating your experience...</h2>
                            <p className="font-sans text-grey-beige">Finding the perfect Bodilicious products for your {answers.focusArea.toLowerCase()} ritual.</p>
                        </motion.div>
                    )}

                    {/* ── RESULTS ── */}
                    {step === 7 && (
                        <motion.div key="results" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full max-w-3xl mx-auto">
                            <div className="text-center mb-10">
                                <span className="inline-flex items-center gap-2 text-ruby-red font-sans uppercase tracking-widest text-xs mb-3">
                                    <Sparkles size={14} /> Your Personalized Ritual
                                </span>
                                <h2 className="text-4xl font-serif text-dark-red mb-4">The Result</h2>
                            </div>

                            {recommendedRoutine.length > 0 ? (
                                <div className="space-y-6">
                                    {recommendedRoutine.map((stepItem, idx) => (
                                        <motion.div key={stepItem.product.pid} custom={idx} variants={stepCardVariants} initial="hidden" animate="visible" className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex gap-6 border border-white shadow-sm hover:shadow-md transition-all">
                                            <div className="w-32 h-32 shrink-0 bg-neutral-50 rounded-xl overflow-hidden p-2">
                                                <img src={stepItem.product.images[0]} alt={stepItem.product.name} className="w-full h-full object-contain mix-blend-multiply" />
                                            </div>
                                            <div className="flex-1 py-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xl">{stepItem.icon}</span>
                                                    <span className="text-[10px] uppercase tracking-widest text-grey-beige font-semibold">{stepItem.stepLabel}</span>
                                                </div>
                                                <h3 className="text-xl font-serif text-dark-red mb-1">{stepItem.product.name}</h3>
                                                <p className="text-sm font-sans text-grey-beige line-clamp-2 italic mb-3">"{stepItem.reason}"</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-dark-red font-bold">₹{stepItem.product.price}</span>
                                                    <button onClick={() => navigateTo('product', stepItem.product.pid)} className="text-xs uppercase tracking-tighter font-semibold text-ruby-red hover:underline">View Product →</button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* ── HOW TO USE GUIDE — Horizontal Carousel Redesign ── */}
                                    <HowToUseCarousel
                                        recommendedRoutine={recommendedRoutine}
                                        navigateTo={navigateTo}
                                        routineTime={answers.routineTime}
                                    />

                                    <div className="mt-12 bg-dark-red text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
                                        <div className="relative z-10">
                                            <h3 className="text-2xl font-serif mb-2">Get the Complete Ritual Bundle</h3>
                                            <p className="text-white/70 mb-6 font-sans text-sm">Experience the full power of Bodilicious by combining these {recommendedRoutine.length} specifically chosen products.</p>
                                            <div className="flex items-center justify-between border-t border-white/20 pt-6">
                                                <div>
                                                    <p className="text-white/50 line-through text-sm font-sans">₹{totalPrice}</p>
                                                    <p className="text-3xl font-serif">₹{comboPrice}</p>
                                                </div>
                                                <button onClick={handleAddFullRitual} className="bg-white text-dark-red px-8 py-3 rounded-xl font-sans uppercase tracking-widest text-sm font-bold hover:shadow-lg transition-transform active:scale-95">Add Ritual to Bag</button>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="text-center py-20 bg-white/40 rounded-3xl border border-white">
                                    <RefreshCcw className="mx-auto text-grey-beige mb-4" size={48} />
                                    <p className="text-xl font-serif text-dark-red">No specific routine found.</p>
                                    <p className="text-grey-beige font-sans mt-2">Try adjusting your filters or browsing our collections.</p>
                                </div>
                            )}

                             <div className="mt-12 text-center">
                                <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 text-grey-beige hover:text-dark-red font-sans text-sm tracking-widest uppercase transition-colors">
                                    <RefreshCcw size={16} /> Reset and Retake Quiz
                                </button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>

                {step > 0 && step < 6 && (
                    <div className="flex justify-between mt-12 w-full max-w-2xl mx-auto h-12 items-center">
                        <button onClick={handleBack} className="text-grey-beige hover:text-dark-red font-sans uppercase tracking-widest text-sm">Back</button>
                        {/* Manual Next only for multiple choice */}
                        {(step === 3) && (
                            <button onClick={handleNext} disabled={!canProceed()} className="bg-ruby-red text-white px-8 py-3 rounded uppercase text-sm tracking-widest shadow-md disabled:bg-neutral-300">Next</button>
                        )}
                    </div>
                )}
            </div>


    </div>
    );
}
