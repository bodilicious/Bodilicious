import { m, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { pageTransitionVariant, getAccessibleVariant } from "../utils/motionTokens";
import ErrorBoundary from "./ErrorBoundary";

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

/**
 * A production-ready wrapper that applies a consistent entrance/exit 
 * animation to all pages, respects OS accessibility preferences, 
 * and catches render errors gracefully.
 *
 * NOTE: The `layout` prop is intentionally omitted here. Combining
 * Framer Motion's `layout` with AnimatePresence route transitions causes
 * layout thrashing — the exiting page's dimensions bleed into the entering
 * page, resulting in clipped or blank-looking renders. Page-level wrappers
 * should only control opacity/transform, never layout.
 */
export default function PageTransition({ children, className = "w-full min-h-screen flex flex-col" }: PageTransitionProps) {
    const shouldReduceMotion = useReducedMotion();
    const accessibleVariant = getAccessibleVariant(pageTransitionVariant, !!shouldReduceMotion);

    return (
        <ErrorBoundary>
            <m.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={accessibleVariant}
                className={className}
                style={{ willChange: "opacity, transform" }}
            >
                {children}
            </m.div>
        </ErrorBoundary>
    );
}
