import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { applyActionCode, confirmPasswordReset, getAuth } from "firebase/auth";

type StatusType = "loading" | "success" | "error";

export default function EmailActionPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<StatusType>("loading");
  const [message, setMessage] = useState("Processing your request...");
  const [mode, setMode] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionProcessed = useRef(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setStatus("error");
      setMessage("Password must be at least 6 characters long.");
      return;
    }
    
    try {
      setIsSubmitting(true);
      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setStatus("success");
      setMode("resetSuccess");
      setMessage("Your password has been reset successfully. You can now sign in.");
    } catch (err: any) {
      console.error("Password reset failed:", err);
      setStatus("error");
      setMessage(err.message || "Failed to reset password. The link might be expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleEmailAction = async () => {
      if (actionProcessed.current) return;
      actionProcessed.current = true;

      const params = new URLSearchParams(location.search);
      const urlMode = params.get("mode");
      const urlOobCode = params.get("oobCode");

      if (!urlMode || !urlOobCode) {
        setStatus("error");
        setMessage("Invalid action link.");
        return;
      }

      setMode(urlMode);
      setOobCode(urlOobCode);

      // If it's a reset password link, stop loading and wait for user input
      if (urlMode === "resetPassword") {
        setStatus("success"); // we use success state to show the form
        return;
      }



      try {
        const auth = getAuth();

        switch (urlMode) {
          case "verifyEmail":
            await applyActionCode(auth, urlOobCode);
            setStatus("success");
            setMessage("Your email has been verified successfully.");

            setTimeout(() => {
              navigate("/signin?verified=1", { replace: true });
            }, 1800);
            break;

          default:
            setStatus("error");
            setMessage("Unsupported email action.");
            break;
        }
      } catch (err) {
        console.error("Email action failed:", err);
        setStatus("error");
        setMessage("This verification link is invalid or has expired.");
      }
    };

    handleEmailAction();
  }, [location.search, navigate]);

  return (
    <div className="bg-silk-light min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-ruby-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-dark-red/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

      <div className="relative w-full max-w-md bg-white p-10 md:p-14 shadow-2xl border border-silk/30 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-dark-red mx-auto mb-6" />
            <h1 className="text-3xl font-serif text-dark-red mb-4">
              Verifying Email
            </h1>
            <p className="text-sm font-sans text-grey-beige leading-relaxed">
              {message}
            </p>
          </>
        )}

        {status === "success" && mode === "resetPassword" && (
          <form onSubmit={handlePasswordReset} className="text-left mt-6">
            <h1 className="text-3xl font-serif text-dark-red mb-4 text-center">
              New Password
            </h1>
            <p className="text-sm font-sans text-grey-beige leading-relaxed text-center mb-6">
              Please enter your new password below.
            </p>
            <div className="mb-6">
              <label className="block text-[10px] uppercase tracking-widest text-grey-beige mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-silk-light/50 border border-silk/50 px-4 py-3 text-sm font-sans focus:outline-none focus:border-dark-red/50 transition-colors disabled:opacity-50"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Save Password"
              )}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            </button>
          </form>
        )}

        {status === "success" && mode !== "resetPassword" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-dark-red mx-auto mb-6" />
            <h1 className="text-3xl font-serif text-dark-red mb-4">
              {mode === "resetSuccess" ? "Password Reset" : "Email Verified"}
            </h1>
            <p className="text-sm font-sans text-grey-beige leading-relaxed mb-8">
              {message}
            </p>
            {mode === "resetSuccess" && (
              <button
                onClick={() => navigate("/signin", { replace: true })}
                className="w-full h-12 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all"
              >
                Go to Sign In
              </button>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-dark-red mx-auto mb-6" />
            <h1 className="text-3xl font-serif text-dark-red mb-4">
              Verification Failed
            </h1>
            <p className="text-sm font-sans text-grey-beige leading-relaxed mb-8">
              {message}
            </p>
            <button
              onClick={() => navigate("/signin", { replace: true })}
              className="w-full h-12 bg-dark-red text-silk font-sans text-xs tracking-widest uppercase hover:bg-ruby-red transition-all"
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}