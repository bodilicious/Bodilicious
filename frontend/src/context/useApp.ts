/**
 * useApp — convenience hook for consuming AppContext.
 *
 * Exported from its own file to comply with the react-refresh/only-export-components
 * rule (mixing hooks and components in the same file degrades HMR reliability).
 *
 * All existing imports of `useApp` from `../context/AppContext` continue to work
 * because AppContext re-exports this hook. New code should prefer importing from
 * this file directly.
 */
export { useApp } from './AppContext';
