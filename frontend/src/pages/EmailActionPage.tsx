import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { applyActionCode, getAuth } from "firebase/auth";

type StatusType = "loading" | "success" | "error";

export default function EmailActionPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<StatusType>("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const actionProcessed = useRef(false);

  useEffect(() => {
    const handleEmailAction = async () => {
      if (actionProcessed.current) return;
      actionProcessed.current = true;

      const params = new URLSearchParams(location.search);
      const mode = params.get("mode");
      const oobCode = params.get("oobCode");

      if (!mode || !oobCode) {
        setStatus("error");
        setMessage("Invalid email action link.");
        return;
      }

      try {
        const auth = getAuth();

        switch (mode) {
          case "verifyEmail":
            await applyActionCode(auth, oobCode);
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

        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-dark-red mx-auto mb-6" />
            <h1 className="text-3xl font-serif text-dark-red mb-4">
              Email Verified
            </h1>
            <p className="text-sm font-sans text-grey-beige leading-relaxed">
              {message}
            </p>
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