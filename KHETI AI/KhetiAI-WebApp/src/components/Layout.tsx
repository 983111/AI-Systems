import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, MessageSquare, ScanSearch, TrendingUp, 
  CloudSun, Landmark, Sprout, Brain, UserCircle, Bell, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Intelligence Hub", href: "/intelligence", icon: Brain },
  { name: "Assistant", href: "/assistant", icon: MessageSquare },
  { name: "Disease Detection", href: "/disease", icon: ScanSearch },
  { name: "Market Prices", href: "/market", icon: TrendingUp },
  { name: "Weather & Satellite", href: "/weather", icon: CloudSun },
  { name: "Loan Eligibility", href: "/loan", icon: Landmark },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const emailName = user?.email?.split("@")[0] ?? null;
  const displayName = profile?.full_name || metadataName || emailName || "Farmer";
  const tier = profile?.subscription_tier ?? "free";

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-stone-100">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-stone-800">AgriIntel</h1>
            <p className="text-xs text-stone-500 font-medium">Farm Assistant</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200",
                  isActive 
                    ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50" 
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 border border-transparent"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-emerald-600" : "text-stone-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 space-y-2">
          <div className="flex items-center gap-3 p-2 rounded-2xl border border-transparent">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <UserCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-stone-800 truncate">{displayName}</p>
              <p className={cn(
                "text-xs font-semibold capitalize truncate",
                tier === "premium" ? "text-amber-600" : "text-emerald-600"
              )}>
                {tier === "premium" ? "Premium Farmer" : "Free Plan"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-stone-50/50">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-stone-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-stone-800 tracking-tight">
            {navItems.find(i => i.href === location.pathname)?.name || "Dashboard"}
          </h2>
          <button className="p-2.5 rounded-full bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors border border-stone-200 shadow-sm relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
