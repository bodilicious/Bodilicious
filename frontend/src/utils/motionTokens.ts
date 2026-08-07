import { Variants, Transition } from "framer-motion";

// --- Durations ---
export const durations = {
    fast: 0.25,
    medium: 0.5,
    slow: 1.0,
    pageTransition: 0.45, // Reduced from 0.8s — pages now feel immediate, not frozen
};

// --- Easings ---
// Luxury feeling: slow, smooth deceleration with minimal to no bounce.
export const easings = {
    standard: [0.25, 1, 0.5, 1] as [number, number, number, number], // Standard fast out, slow in
    luxury: [0.22, 1, 0.36, 1] as [number, number, number, number],  // Smoother, elegant sine
    springLike: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] // Very subtle controlled overshoot
};

// --- Base Transitions ---
export const transitions = {
    default: {
        duration: durations.medium,
        ease: easings.luxury,
    } as Transition,
    fade: {
        duration: durations.fast,
        ease: easings.standard,
    } as Transition,
    layout: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 1,
    } as Transition,
};

// --- Reusable Variants (Safe for Layout Shifts) ---
// Note: We strictly animate only `opacity` and `y` (transform) here to avoid CLS.

/**
 * Standard Fade Up
 * Ideal for headers and text blocks
 */
export const fadeUpVariant: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.default
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: transitions.fade
    }
};

/**
 * Page Transition Wrapper Variant
 * Soft fade in + very slow slide up
 */
export const pageTransitionVariant: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: durations.pageTransition,
            ease: easings.luxury,
            when: "beforeChildren",
        }
    },
    exit: {
        opacity: 0,
        y: -5,
        transition: { duration: durations.fast, ease: easings.standard }
    }
};

/**
 * Stagger Container
 * Used to sequentially reveal children components (e.g., a product grid).
 * staggerChildren reduced from 0.2 -> 0.06 to prevent scheduling 37+ sequential
 * JS animation tasks that cause main-thread jank.
 */
export const staggerContainerVariant: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
            delayChildren: 0.1,
        }
    }
};

/**
 * Hover Lift
 * Tactile micro-interaction string for motion.div `whileHover`
 */
export const hoverLift = {
    scale: 1.02,
    y: -2,
    transition: { duration: durations.medium, ease: easings.luxury }
};

export const hoverLiftSubtle = {
    scale: 1.01,
    y: -1,
    transition: { duration: durations.medium, ease: easings.luxury }
};

// --- Accessibility Wrapper Hook ---
/**
 * Utility to strip transforms if reduced motion is requested by the OS.
 * Returns either the full variant or a stripped opacity-only version.
 */
export const getAccessibleVariant = (variant: Variants, shouldReduceMotion: boolean): Variants => {
    if (!shouldReduceMotion) return variant;

    // If user prefers reduced motion, we strip `y`, `x`, `scale` from all states
    // and only preserve `opacity` and basic transitions.
    const reducedVariant: any = {};

    for (const key in variant) {
        if (Object.prototype.hasOwnProperty.call(variant, key)) {
            const state = { ...(variant[key] as any) };

            // Remove positional/scale transforms
            delete state.y;
            delete state.x;
            delete state.scale;

            // Ensure opacity exists if it wasn't there
            if (key === 'hidden' && state.opacity === undefined) state.opacity = 0;
            if (key === 'visible' && state.opacity === undefined) state.opacity = 1;

            reducedVariant[key] = state;
        }
    }

    return reducedVariant as Variants;
};
