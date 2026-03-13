import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Sprout } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600 inline-block mb-2">
            <Sprout className="w-8 h-8" />
          </div>
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
