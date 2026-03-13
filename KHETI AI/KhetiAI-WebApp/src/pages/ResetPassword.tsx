import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Sprout, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type PageState = "loading" | "ready" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase puts the recovery session in the URL hash as:
    // #access_token=...&type=recovery
    // Calling getSession() after onAuthStateChange fires is the reliable way.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setPageState("ready");
      } else if (event === "SIGNED_IN" && session) {
        // Sometimes fires instead of PASSWORD_RECOVERY on some clients
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          setPageState("ready");
        }
      }
    });

    // Also check immediately in case the event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = window.location.hash;
      if (session && hash.includes("type=recovery")) {
        setPageState("ready");
      } else if (!session && pageState === "loading") {
        // Give it 3 seconds for the hash to be processed
        setTimeout(() => {
          setPageState((prev) => (prev === "loading" ? "error" : prev));
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMsg(error.message);
      setSubmitting(false);
    } else {
      setPageState("success");
      setTimeout(() => navigate("/", { replace: true }), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
            <Sprout className="w-7 h-7" />
          </div>
          <span className="font-bold text-2xl text-stone-800 tracking-tight">AgriIntel</span>
        </div>

        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-8">

          {/* Loading */}
          {pageState === "loading" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
              </div>
              <p className="text-stone-600 font-medium">Verifying your reset link...</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === "error" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">Link expired or invalid</h2>
                <p className="text-stone-500 text-sm">This password reset link has expired or already been used.</p>
              </div>
              <button
                onClick={() => navigate("/auth", { replace: true })}
                className="mt-4 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
              >
                Request a new link
              </button>
            </div>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">Password updated!</h2>
                <p className="text-stone-500 text-sm">Signing you in and redirecting to your dashboard...</p>
              </div>
            </div>
          )}

          {/* Reset form */}
          {pageState === "ready" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-stone-800 mb-2 tracking-tight">Set new password</h2>
                <p className="text-stone-500 text-sm font-medium">Choose a strong password for your account.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-stone-700">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-stone-800 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-stone-700">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleReset()}
                      placeholder="Repeat your new password"
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-stone-800 shadow-sm"
                    />
                  </div>
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "flex-1 h-1.5 rounded-full transition-colors",
                            password.length >= level * 3
                              ? level <= 1 ? "bg-red-400"
                                : level <= 2 ? "bg-amber-400"
                                : level <= 3 ? "bg-emerald-400"
                                : "bg-emerald-600"
                              : "bg-stone-200"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-stone-400 font-medium">
                      {password.length < 4 ? "Too short" : password.length < 7 ? "Weak" : password.length < 10 ? "Good" : "Strong"}
                    </p>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={submitting || !password || !confirmPassword}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
