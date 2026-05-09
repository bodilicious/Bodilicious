import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * A fallback wrapper to ensure page crashes during animation transitions 
 * don't completely freeze the application or empty the DOM.
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught runtime error intercepted by ErrorBoundary:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[50vh] flex flex-col items-center justify-center bg-neutral-50 px-4 text-center">
                    <div className="w-16 h-16 bg-red-50 text-dark-red rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle size={32} />
                    </div>
                    <h2 className="font-serif text-2xl text-dark-red mb-3">Something went wrong.</h2>
                    <p className="font-sans text-gray-500 mb-6 max-w-md">
                        We encountered an unexpected error while preparing this page. Please try refreshing.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-dark-red text-silk font-sans text-sm tracking-wide uppercase hover:bg-ruby-red transition-colors rounded-sm"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
