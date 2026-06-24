 
import { useState, useEffect } from 'react';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { Sparkles, Edit3, ArrowRight, Activity, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    user: User | null;
    onSave: (data: Partial<User>) => Promise<void>;
    navigateTo: (page: any) => void;
}

const SKIN_TYPES = ['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'];
const SKIN_CONCERNS = ['Acne', 'Dark Spots', 'Aging', 'Pigmentation', 'Dullness', 'Dryness'];
const ROUTINES = ['Morning Routine', 'Night Routine', 'Both'];

export default function SkinProfileSection({ user, onSave, navigateTo }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [skinType, setSkinType] = useState<string>('');
    const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
    const [routine, setRoutine] = useState<string>('');

    useEffect(() => {
        if (user) {
            setSkinType(user.skinType || '');
            setSkinConcerns(user.skinConcerns || []);
            setRoutine(user.preferredRoutine || '');
        }
    }, [user]);

    const toggleConcern = (concern: string) => {
        if (!isEditing) return;
        setSkinConcerns(prev =>
            prev.includes(concern)
                ? prev.filter(c => c !== concern)
                : [...prev, concern]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                skinType: skinType as any,
                skinConcerns,
                preferredRoutine: routine as any
            });
            toast.success("Skin profile updated successfully");
            setIsEditing(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to save skin profile");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return (
        <div className="animate-pulse flex flex-col gap-4 mb-8">
            <div className="h-64 bg-silk-light rounded-2xl border border-silk w-full"></div>
        </div>
    );

    const hasData = !!(user.skinType && user.skinConcerns?.length);

    return (
        <div className="bg-white border border-silk rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-ruby-red/10 rounded-full flex items-center justify-center text-ruby-red">
                        <Sparkles size={18} />
                    </div>
                    <h3 className="font-serif text-dark text-lg">Skin Insight</h3>
                </div>
                {hasData && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-grey-beige hover:text-dark transition-colors"
                        title="Edit Profile"
                    >
                        <Edit3 size={18} />
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isEditing ? (
                    <motion.div
                        key="edit"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                    >
                        {/* Skin Type */}
                        <div>
                            <h4 className="font-sans font-medium text-xs text-grey-beige uppercase tracking-widest mb-3">Skin Type</h4>
                            <div className="flex flex-wrap gap-2">
                                {SKIN_TYPES.map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSkinType(type)}
                                        className={`px-4 py-2 rounded-xl font-sans text-sm border transition-all ${skinType === type
                                                ? 'bg-dark border-dark text-white shadow-md'
                                                : 'bg-silk-light border-silk text-dark/70 hover:border-dark/30'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Skin Concerns */}
                        <div>
                            <h4 className="font-sans font-medium text-xs text-grey-beige uppercase tracking-widest mb-3">Top Concerns</h4>
                            <div className="flex flex-wrap gap-2">
                                {SKIN_CONCERNS.map(concern => (
                                    <button
                                        key={concern}
                                        type="button"
                                        onClick={() => toggleConcern(concern)}
                                        className={`px-4 py-2 rounded-xl font-sans text-sm border transition-all ${skinConcerns.includes(concern)
                                                ? 'bg-ruby-red border-ruby-red text-white shadow-md'
                                                : 'bg-silk-light border-silk text-dark/70 hover:border-dark/30'
                                            }`}
                                    >
                                        {concern}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preferred Routine */}
                        <div>
                            <h4 className="font-sans font-medium text-xs text-grey-beige uppercase tracking-widest mb-3">Routine Type</h4>
                            <div className="flex flex-wrap gap-2">
                                {ROUTINES.map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRoutine(r)}
                                        className={`px-4 py-2 rounded-xl font-sans text-sm border transition-all ${routine === r
                                                ? 'bg-dark border-dark text-white shadow-md'
                                                : 'bg-silk-light border-silk text-dark/70 hover:border-dark/30'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-silk/60">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-dark text-white px-8 py-3 rounded-xl font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Insights'}
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                disabled={isSaving}
                                className="text-grey-beige hover:text-dark font-sans text-xs tracking-widest uppercase px-4"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                ) : hasData ? (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-silk-light/40 rounded-2xl p-4 border border-silk/20">
                                <Activity size={16} className="text-ruby-red mb-2" />
                                <p className="font-sans text-[10px] uppercase tracking-widest text-grey-beige mb-1">Skin Type</p>
                                <p className="font-serif text-dark text-base">{user.skinType}</p>
                            </div>
                            <div className="bg-silk-light/40 rounded-2xl p-4 border border-silk/20">
                                <Zap size={16} className="text-amber-600 mb-2" />
                                <p className="font-sans text-[10px] uppercase tracking-widest text-grey-beige mb-1">Top Concern</p>
                                <p className="font-serif text-dark text-base truncate">{user.skinConcerns?.[0] || 'General Care'}</p>
                            </div>
                            <div className="bg-silk-light/40 rounded-2xl p-4 border border-silk/20">
                                <ShieldCheck size={16} className="text-indigo-600 mb-2" />
                                <p className="font-sans text-[10px] uppercase tracking-widest text-grey-beige mb-1">Recommended</p>
                                <p className="font-serif text-dark text-base">{user.preferredRoutine || 'Full Ritual'}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-2">
                            <button
                                onClick={() => navigateTo('ritual-finder')}
                                className="flex-1 bg-ruby-red text-white px-6 py-4 rounded-2xl font-sans text-sm tracking-widest uppercase hover:bg-dark-red transition-all shadow-md group flex items-center justify-center gap-3"
                            >
                                View Personalized Routine
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-6 py-4 rounded-2xl border border-silk font-sans text-sm tracking-widest uppercase text-dark hover:bg-silk-light transition-all flex items-center justify-center gap-2"
                            >
                                <Edit3 size={16} /> Update Profile
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col sm:flex-row items-center gap-6 py-2"
                    >
                        <div className="flex-1 text-center sm:text-left">
                            <p className="font-serif text-dark text-lg mb-1">Your skin, decoded</p>
                            <p className="font-sans text-grey-beige text-xs leading-relaxed max-w-xs">
                                Tell us your skin type and concerns to unlock a personalized ritual.
                            </p>
                            <button
                                onClick={() => navigateTo('ritual-finder')}
                                className="mt-3 text-[10px] font-sans text-ruby-red uppercase tracking-widest font-bold underline underline-offset-4 flex items-center gap-1 mx-auto sm:mx-0"
                            >
                                Try the Ritual Finder <ArrowRight size={12} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
