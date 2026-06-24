import { motion } from 'framer-motion';
import { CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import { User, Order } from '../../types';

interface Props {
    user: User | null;
    orders: Order[];
}

export default function ProfileCompletionCard({ user, orders }: Props) {
    if (!user) return null;

    const steps = [
        { id: 'photo', label: 'Upload profile photo', completed: !!user.photoURL },
        { id: 'info', label: 'Complete personal info', completed: !!(user.displayName && user.phone && user.gender) },
        { id: 'address', label: 'Save delivery address', completed: !!(user.addresses && user.addresses.length > 0) },
        { id: 'order', label: 'Place your first order', completed: orders.length > 0 },
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const percentage = Math.round((completedCount / steps.length) * 100);

    if (percentage === 100) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-silk rounded-2xl p-5 mb-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-ruby-red/10 flex items-center justify-center text-ruby-red">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <h3 className="font-serif text-dark text-base leading-tight">Profile Completion</h3>
                        <p className="font-sans text-grey-beige text-[10px]">Unlock a fully personalized experience</p>
                    </div>
                </div>
                <span className="font-sans text-sm font-bold text-ruby-red bg-ruby-red/10 px-3 py-1 rounded-full">{percentage}%</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-silk rounded-full overflow-hidden mb-4">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-full bg-ruby-red rounded-full"
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </div>

            {/* Steps Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6">
                {steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2">
                        {step.completed ? (
                            <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                        ) : (
                            <Circle size={13} className="text-silk shrink-0" />
                        )}
                        <span className={`font-sans text-[11px] ${step.completed ? 'text-grey-beige line-through opacity-60' : 'text-dark'}`}>
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
