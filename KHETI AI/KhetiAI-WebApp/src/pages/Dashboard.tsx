import { CloudSun, ScanSearch, TrendingUp, Landmark, ArrowRight, MapPin, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, user } = useAuth();
  const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const emailName = user?.email?.split("@")[0] ?? null;
  const displayName = profile?.full_name || metadataName || emailName || "Farmer";

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 text-white rounded-[2rem] p-10 shadow-xl relative overflow-hidden border border-emerald-600/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] opacity-40 -translate-y-1/2 translate-x-1/4 mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500 rounded-full blur-[80px] opacity-30 translate-y-1/2 -translate-x-1/4 mix-blend-screen"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Farm Status: Optimal
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome back, {displayName}</h1>
          <p className="text-emerald-50 text-lg mb-8 leading-relaxed font-medium opacity-90">
            Your fields look healthy today. The weather is optimal for sowing wheat.
            Market prices for soybeans have increased by 4% since yesterday.
          </p>
          <Link 
            to="/assistant" 
            className="inline-flex items-center gap-2 bg-white text-emerald-900 px-7 py-3.5 rounded-2xl font-bold hover:bg-emerald-50 hover:scale-[1.02] transition-all shadow-lg shadow-emerald-900/20"
          >
            Ask Assistant
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Weather Forecast"
          value="28°C"
          subtitle="Clear sky, 40% humidity"
          icon={CloudSun}
          href="/weather"
          color="bg-sky-100 text-sky-600"
        />
        <DashboardCard 
          title="Crop Health"
          value="92%"
          subtitle="No major diseases detected"
          icon={ScanSearch}
          href="/disease"
          color="bg-emerald-100 text-emerald-600"
        />
        <DashboardCard 
          title="Market Trends"
          value="Soybean ↑"
          subtitle="₹4,200 / quintal"
          icon={TrendingUp}
          href="/market"
          color="bg-amber-100 text-amber-600"
        />
        <DashboardCard 
          title="Loan Eligibility"
          value="Pre-approved"
          subtitle="Kisan Credit Card up to ₹3L"
          icon={Landmark}
          href="/loan"
          color="bg-indigo-100 text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-stone-200/80 shadow-sm flex flex-col group/card hover:shadow-md transition-all">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-stone-800 tracking-tight">Recent Satellite Imagery</h3>
            <span className="flex items-center gap-1.5 text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-full">
              <RefreshCw className="w-3.5 h-3.5" />
              Updated 2h ago
            </span>
          </div>
          <div className="aspect-video bg-stone-100 rounded-2xl overflow-hidden relative group flex-1">
            <img 
              src="https://picsum.photos/seed/farm/800/450" 
              alt="Farm satellite view" 
              className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay pointer-events-none group-hover:opacity-0 transition-opacity duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent flex flex-col justify-end p-5">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 text-emerald-300 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Sector 4 (North)</span>
                  </div>
                  <p className="text-white text-lg font-bold">NDVI Index: 0.75 <span className="text-emerald-400 text-sm ml-1">(Healthy)</span></p>
                </div>
                <Link to="/weather" className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2.5 rounded-xl transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-stone-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-stone-800 tracking-tight">Fertilizer Recommendations</h3>
            <button className="text-emerald-600 text-sm font-bold hover:text-emerald-700 transition-colors">View All</button>
          </div>
          <ul className="space-y-4">
            <li className="p-5 rounded-2xl bg-stone-50 border border-stone-100 hover:border-emerald-200 hover:shadow-sm transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-extrabold text-lg shadow-inner">N</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-stone-800">Urea (Nitrogen)</p>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">Action Required</span>
                  </div>
                  <p className="text-sm text-stone-500 font-medium">Apply 45 kg/acre before irrigation.</p>
                </div>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '40%' }}></div>
              </div>
              <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
                <span>Current: Low</span>
                <span>Target: Optimal</span>
              </div>
            </li>
            <li className="p-5 rounded-2xl bg-stone-50 border border-stone-100 hover:border-amber-200 hover:shadow-sm transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-extrabold text-lg shadow-inner">P</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-stone-800">DAP (Phosphorus)</p>
                    <span className="text-xs font-bold text-stone-500 bg-stone-200 px-2.5 py-1 rounded-full">Optimal</span>
                  </div>
                  <p className="text-sm text-stone-500 font-medium">Soil levels are adequate. No immediate application needed.</p>
                </div>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
                <span>Current: Good</span>
                <span>Target: Optimal</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, subtitle, icon: Icon, href, color }: any) {
  return (
    <Link to={href} className="block group">
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-200 relative overflow-hidden h-full">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 ${color.split(' ')[0]}`}></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className={`p-3.5 rounded-2xl shadow-sm border border-white/50 ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="p-2 rounded-full bg-stone-50 text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-sm font-bold text-stone-500 mb-1.5 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-stone-800 mb-2 tracking-tight">{value}</h3>
          <p className="text-sm font-medium text-stone-500">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
