import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSEO } from "../hooks/useSEO";

type Mode = "signin" | "signup" | "forgot-password";

export default function SignInPage() {
  useSEO({
    title: 'Sign In / Sign Up',
    description: 'Sign in to your account.',
    noIndex: true
  });

  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    authStatus,
    authLoading,
    isAuthenticated,
    navigateTo,
    refreshAuthState,
    cartCount,
    resendVerificationEmail,
    triggerPasswordReset,
    logout,
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const verified = new URLSearchParams(location.search).get("verified");
    if (verified === "1") {
      setInfo("Email verified successfully. You can now sign in.");
    }
  }, [location.search]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      const rawReturnTo = location.state?.returnTo;
      let safeReturnTo = "/account";

      if (
        typeof rawReturnTo === "string" &&
        rawReturnTo.startsWith("/") &&
        !rawReturnTo.startsWith("//")
      ) {
        safeReturnTo = rawReturnTo;
      } else if (cartCount > 0) {
        safeReturnTo = "/cart";
      }

      navigate(safeReturnTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, location.state, navigate, cartCount]);



  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setInfo(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      let cleanError = "An unexpected error occurred. Please try again.";

      if (fbErr.code === "auth/popup-closed-by-user") cleanError = "Login cancelled.";
      if (fbErr.code === "auth/popup-blocked") cleanError = "Popup blocked.";
      if (fbErr.code === "auth/network-request-failed") cleanError = "Network error.";

      setError(cleanError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "forgot-password") {
      if (!email) {
        setError("Please enter your email address.");
        return;
      }
      try {
        setIsSubmitting(true);
        await triggerPasswordReset(email);
        setInfo("If an account exists, a reset link was sent.");
      } catch (err: any) {
        setError(err.message || "Failed to trigger password reset.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email || !password || (mode === "signup" && !name.trim())) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name.trim());
        setInfo("Account created. Please verify your email to continue.");
      }
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      let cleanError = "Authentication failed. Please check your credentials.";

      if (fbErr.code === "auth/email-already-in-use") {
        cleanError = "An account with this email already exists.";
      }
      if (fbErr.code === "auth/invalid-credential") {
        cleanError = "Invalid email or password.";
      }
      if (
        fbErr.code === "auth/user-not-found" ||
        fbErr.code === "auth/wrong-password"
      ) {
        cleanError = "Invalid email or password.";
      }
      if (fbErr.code === "auth/network-request-failed") {
        cleanError = "Network error.";
      }

      setError(cleanError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
    setPassword("");
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
        <p className="text-xs uppercase tracking-widest font-sans text-dark-red">
          Loading Bodilicious...
        </p>
      </div>
    );
  }

  if (authStatus === "awaiting-verification") {
    return (
      <div className="bg-silk-light min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-ruby-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-dark-red/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

        <div className="relative w-full max-w-md bg-white p-10 md:p-14 shadow-2xl shadow-dark-red/5 border border-silk/30 text-center">
          <h1 className="text-3xl font-serif text-dark-red mb-4">
            Verify Your Email
          </h1>
          <p className="text-sm font-sans text-grey-beige leading-relaxed mb-8">
            We've sent a verification link to your email address. Please verify your email to continue.
          </p>
          
          {error && (
            <div className="mb-4 px-4 py-3 bg-indian-red/5 border border-indian-red/20 text-indian-red text-xs font-sans tracking-wide">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-6 px-4 py-3 bg-dark-red/5 border border-dark-red/20 text-dark-red text-xs font-sans tracking-wide">
              {info}
            </div>
          )}

          <button
            onClick={() => refreshAuthState()}
            className="w-full h-12 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all duration-300 mb-4"
          >
            I've Verified My Email
          </button>
          
          <button
            onClick={async () => {
              try {
                await resendVerificationEmail();
                setInfo("Verification email sent!");
                setError(null);
              } catch (err: any) {
                setError(err.message || "Failed to resend.");
                setInfo(null);
              }
            }}
            className="w-full h-12 bg-white border border-silk text-grey-beige font-sans text-xs tracking-widest uppercase hover:border-dark-red hover:text-dark-red transition-all duration-300 mb-8"
          >
            Resend Email
          </button>
          
          <button
            onClick={() => logout()}
            className="text-[10px] font-sans text-grey-beige uppercase tracking-widest hover:text-dark-red transition-colors underline underline-offset-4"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-silk-light min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-ruby-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-dark-red/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-md bg-white p-10 md:p-14 shadow-2xl shadow-dark-red/5 border border-silk/30 text-center">
        <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-ruby-red mb-4">
          {mode === "signin" ? "Welcome Back To" : mode === "signup" ? "Join" : "Reset Password For"}
        </p>

        <h1 className="text-4xl md:text-5xl font-serif text-dark-red mb-2 tracking-tight">
          Bodilicious
        </h1>

        {location.state?.reason === "checkout" && !error && !info ? (
          <p className="text-[11px] font-sans tracking-widest text-indian-red mb-8">
            Please sign in to securely checkout
          </p>
        ) : (
          <div className="mb-8 block" />
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-indian-red/5 border border-indian-red/20 text-indian-red text-xs font-sans tracking-wide">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-6 px-4 py-3 bg-dark-red/5 border border-dark-red/20 text-dark-red text-xs font-sans tracking-wide">
            {info}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4 mb-8 text-left">
          {mode === "signup" && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-grey-beige mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-silk-light/50 border border-silk/50 px-4 py-3 text-sm font-sans focus:outline-none focus:border-dark-red/50 transition-colors disabled:opacity-50"
                placeholder="Your Name"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-grey-beige mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-silk-light/50 border border-silk/50 px-4 py-3 text-sm font-sans focus:outline-none focus:border-dark-red/50 transition-colors disabled:opacity-50"
              placeholder="you@example.com"
            />
          </div>

          {mode !== "forgot-password" && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-grey-beige mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-silk-light/50 border border-silk/50 px-4 py-3 text-sm font-sans focus:outline-none focus:border-dark-red/50 transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
              {mode === "signin" && (
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot-password");
                      setError(null);
                      setInfo(null);
                    }}
                    disabled={isSubmitting}
                    className="text-[10px] font-sans text-grey-beige hover:text-dark-red uppercase tracking-widest disabled:opacity-50"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-4 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "signin" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Reset Password"
            )}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
          </button>
        </form>

        {mode !== "forgot-password" && (
          <>
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-silk/30"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-white px-4 text-grey-beige bg-opacity-100">
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full h-12 bg-white border border-silk text-grey-beige font-sans text-xs tracking-widest uppercase hover:border-dark-red hover:text-dark-red transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-3">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                      className="opacity-80"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                      className="opacity-80"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                      className="opacity-80"
                    />
                  </svg>
                  Google
                </span>
              )}
            </button>
          </>
        )}

        <div className="mt-8 text-[11px] font-sans text-grey-beige">
          {mode === "signin" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                onClick={toggleMode}
                disabled={isSubmitting}
                className="text-dark-red uppercase tracking-wider underline underline-offset-4 hover:text-ruby-red disabled:opacity-50"
              >
                Sign up
              </button>
            </p>
          ) : mode === "signup" ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={toggleMode}
                disabled={isSubmitting}
                className="text-dark-red uppercase tracking-wider underline underline-offset-4 hover:text-ruby-red disabled:opacity-50"
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Remember your password?{" "}
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                disabled={isSubmitting}
                className="text-dark-red uppercase tracking-wider underline underline-offset-4 hover:text-ruby-red disabled:opacity-50"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <button
          onClick={() => navigateTo("home")}
          disabled={isSubmitting}
          className="absolute top-6 left-6 text-[10px] font-sans text-grey-beige uppercase tracking-widest hover:text-dark-red transition-colors border-b border-transparent hover:border-dark-red pb-0.5 disabled:opacity-50"
        >
          Return
        </button>
      </div>
    </div>
  );
}