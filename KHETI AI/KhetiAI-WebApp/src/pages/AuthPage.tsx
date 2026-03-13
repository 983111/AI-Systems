import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Sprout, Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Account created! Check your email to confirm, then sign in." });

      } else if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Explicit navigation — don't rely solely on AuthContext listener
        if (data.session) {
          navigate("/", { replace: true });
        }

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Password reset email sent. Check your inbox." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message ?? "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setMessage(null);
    setEmail("");
    setPassword("");
    setFullName("");
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left: Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[120px] opacity-30 -translate-y-1/2 translate-x-1/4 mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500 rounded-full blur-[100px] opacity-25 translate-y-1/2 -translate-x-1/4 mix-blend-screen pointer-events-none"></div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
            <Sprout className="w-7 h-7 text-white" />
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">AgriIntel</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-6 tracking-tight">
            Intelligence for<br />every farmer.
          </h1>
          <p className="text-emerald-100 text-lg leading-relaxed mb-12 max-w-md opacity-90">
            Crop disease detection, market forecasting, weather alerts, and loan eligibility — built for Indian farmers.
          </p>
          <div className="space-y-4">
            {[
              "Real-time crop disease detection",
              "3-month market price forecasts",
              "Hyper-local weather & satellite imagery",
              "Loan eligibility & government schemes",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-400/30 border border-emerald-400/50 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-300"></div>
                </div>
                <span className="text-emerald-100 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-emerald-300/60 text-sm relative z-10">
          © {new Date().getFullYear()} AgriIntel. Built for Bharat's farmers.
        </p>
      </div>

      {/* Right: Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Sprout className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl text-stone-800">AgriIntel</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-stone-800 mb-2 tracking-tight">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset password"}
            </h2>
            <p className="text-stone-500 font-medium">
              {mode === "signin" && "Sign in to your AgriIntel account"}
              {mode === "signup" && "Start your free AgriIntel account today"}
              {mode === "forgot" && "We'll send you a reset link"}
            </p>
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-stone-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-stone-800 shadow-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-stone-800 shadow-sm"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-stone-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
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
                {mode === "signin" && (
                  <div className="text-right pt-1">
                    <button
                      onClick={() => switchMode("forgot")}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {message && (
              <div className={cn(
                "p-4 rounded-xl text-sm font-medium border",
                message.type === "error"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}>
                {message.text}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim() || (mode !== "forgot" && !password)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === "signin" && "Sign In"}
                  {mode === "signup" && "Create Account"}
                  {mode === "forgot" && "Send Reset Link"}
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            {mode === "signin" ? (
              <p className="text-stone-500 text-sm">
                Don't have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                >
                  Sign up free
                </button>
              </p>
            ) : (
              <p className="text-stone-500 text-sm">
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("signin")}
                  className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
