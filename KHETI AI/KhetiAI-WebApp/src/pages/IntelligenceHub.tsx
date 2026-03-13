import { useState, useEffect } from "react";
import { 
  Brain, Sprout, Bug, Tractor, TrendingUp, Lightbulb, ArrowRight, 
  Activity, ThermometerSun, Eye, ShieldAlert, Users, Droplets, 
  Wrench, LineChart, Wallet, ShieldCheck, BookOpen, Network, Leaf,
  X, CheckCircle2, AlertTriangle, Info, MessageSquare, Zap, Loader2
} from "lucide-react";
import { Link } from "react-router-dom";

const agentCategories = [
  {
    title: "Crop & Soil Intelligence",
    icon: Sprout,
    color: "bg-emerald-100 text-emerald-600",
    agents: [
      {
        name: "Soil Memory Agent",
        icon: Activity,
        description: "Tracks soil health inputs over seasons and years, correlates decisions with actual yield outcomes, then builds a farm-specific playbook.",
        status: "Active",
        insights: [
          { type: "alert", text: "Field B shows 12% yield drop correlated with deep tilling in 2024. Recommendation: Switch to no-till." },
          { type: "success", text: "Cover crop mix (Radish/Rye) in Field A increased soil organic matter by 0.4% over 2 years." },
          { type: "info", text: "Historical data suggests applying Nitrogen 1 week later than regional average yields best results for your soil type." }
        ]
      },
      {
        name: "Microclimate Deviation Agent",
        icon: ThermometerSun,
        description: "Learns the specific microclimates within a single farm and gives field-by-field alerts, moving beyond regional weather data.",
        status: "Learning",
        insights: [
          { type: "alert", text: "Frost pocket detected in North-West corner. Temperatures drop 2.5°C lower than regional average." },
          { type: "info", text: "South-facing slope (Field C) accumulates growing degree days 15% faster. Ready for early harvest." }
        ]
      },
      {
        name: "Crop Stress Early Warning",
        icon: Eye,
        description: "Combines satellite imagery, soil moisture, and weather to detect stress 2-3 weeks before it's visible to the human eye.",
        status: "Active",
        insights: [
          { type: "alert", text: "Early signs of water stress detected in Soybean Sector 4 despite recent irrigation. Check drip lines for leaks." },
          { type: "success", text: "Wheat crop in Sector 1 showing optimal canopy development. No stress detected." }
        ]
      }
    ]
  },
  {
    title: "Pest & Disease",
    icon: Bug,
    color: "bg-red-100 text-red-600",
    agents: [
      {
        name: "Pest Migration Predictor",
        icon: Bug,
        description: "Tracks pest pressure reports across a region and predicts when and where infestations will move next.",
        status: "Active",
        insights: [
          { type: "alert", text: "Fall Armyworm detected 50km South. Wind patterns suggest arrival in 4-6 days. High risk for late-planted corn." },
          { type: "info", text: "Preparing preventive spray schedule based on predicted arrival window." }
        ]
      },
      {
        name: "Resistance Evolution Tracker",
        icon: ShieldAlert,
        description: "Monitors which pesticides are losing effectiveness in your region by aggregating anonymous farmer outcome data.",
        status: "Beta",
        insights: [
          { type: "alert", text: "Warning: 40% of neighboring farms report reduced efficacy of Imidacloprid against aphids this season." },
          { type: "info", text: "Recommendation: Rotate to a Group 9 or Group 29 insecticide for next application." }
        ]
      }
    ]
  },
  {
    title: "Farm Operations",
    icon: Tractor,
    color: "bg-amber-100 text-amber-600",
    agents: [
      {
        name: "Labor Timing Optimizer",
        icon: Users,
        description: "Coordinates labor availability, weather windows, equipment schedules, and crop readiness simultaneously.",
        status: "Active",
        insights: [
          { type: "success", text: "Optimal harvest window identified: Next Tuesday to Thursday. Weather is clear, equipment is available." },
          { type: "info", text: "Requires 4 additional temporary workers to complete harvest before Friday rain." }
        ]
      },
      {
        name: "Input Waste Auditor",
        icon: Droplets,
        description: "Tracks actual vs. planned usage of water, fertilizer, and chemicals across seasons to identify waste.",
        status: "Learning",
        insights: [
          { type: "alert", text: "Irrigation Zone 3 is using 20% more water than Zone 2 for the same crop yield. Possible runoff issue." },
          { type: "info", text: "Fertilizer overlap detected on headlands. Adjusting GPS guidance paths could save ₹4,500/season." }
        ]
      },
      {
        name: "Equipment Failure Predictor",
        icon: Wrench,
        description: "Learns the usage patterns of your specific machines and flags maintenance needs before breakdowns happen.",
        status: "Setup Required",
        insights: [
          { type: "info", text: "Connect your John Deere Operations Center account to enable predictive maintenance alerts." }
        ]
      }
    ]
  },
  {
    title: "Market & Financial",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-600",
    agents: [
      {
        name: "Commodity Timing Agent",
        icon: LineChart,
        description: "Watches futures markets, regional basis prices, storage costs, and your own production timeline to suggest the optimal moment to sell.",
        status: "Active",
        insights: [
          { type: "success", text: "Soybean basis is unusually strong at local elevator (+₹150/q). Recommended action: Sell 30% of stored crop now." },
          { type: "info", text: "Storage costs will exceed projected price gains by week 14. Target liquidation before then." }
        ]
      },
      {
        name: "Input Price Arbitrage Agent",
        icon: Wallet,
        description: "Monitors prices across suppliers, co-ops, and buying groups for seeds, fertilizer, and chemicals.",
        status: "Active",
        insights: [
          { type: "success", text: "Urea prices dropped 4% at regional co-op. Bulk buying now for next season saves estimated ₹12,000." },
          { type: "info", text: "Monitoring seed prices for next season. Currently 5% above historical average." }
        ]
      },
      {
        name: "Crop Insurance Optimizer",
        icon: ShieldCheck,
        description: "Analyzes your historical yield data, local risk profiles, and available policies to find gaps in your coverage.",
        status: "Beta",
        insights: [
          { type: "alert", text: "Current policy under-insures Field C based on its 5-year historical yield average." },
          { type: "info", text: "Adding hail endorsement is statistically favorable this year due to predicted La Niña patterns." }
        ]
      }
    ]
  },
  {
    title: "Genuinely Novel",
    icon: Lightbulb,
    color: "bg-purple-100 text-purple-600",
    agents: [
      {
        name: "Farmer Knowledge Preservation Agent",
        icon: BookOpen,
        description: "Interviews older farmers and captures their hyperlocal, generational knowledge before it's lost forever.",
        status: "Beta",
        insights: [
          { type: "success", text: "Successfully logged 14 oral histories regarding flood patterns in the lower valley from 1980-2010." },
          { type: "info", text: "Correlating historical 'red sky' observations with modern barometric pressure drops." }
        ]
      },
      {
        name: "Cross-Farm Anomaly Detector",
        icon: Network,
        description: "Aggregates data across neighboring farms and flags when one farm is consistently outperforming on a specific metric.",
        status: "Opt-in Required",
        insights: [
          { type: "info", text: "Join the local data cooperative to see how your water efficiency compares to neighbors with similar soil types." }
        ]
      },
      {
        name: "Regenerative Transition Planner",
        icon: Leaf,
        description: "Models the 2-4 year yield dip transition curve for farms switching from conventional to regenerative.",
        status: "Active",
        insights: [
          { type: "info", text: "Year 2 of transition: Projected 8% yield dip, but input costs are down 15%. Net margin is positive." },
          { type: "success", text: "Soil carbon sequestration metrics qualify for new carbon credit program. Estimated payout: ₹45,000." }
        ]
      }
    ]
  }
];

function SynergyWorkflow() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => setStep(2), 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="bg-stone-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden mb-12 border border-stone-800">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-stone-800 p-2.5 rounded-xl border border-stone-700 shadow-inner">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Autonomous Agent Synergy</h2>
            <p className="text-sm text-stone-400 font-medium">Cross-agent intelligence activated</p>
          </div>
        </div>
        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          LIVE MONITORING
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-4 relative z-10">
        {/* Agent 1: Pest Predictor */}
        <div className="flex-1 bg-stone-800/50 border border-stone-700/50 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <Bug className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-stone-200">Pest Migration Predictor</h3>
          </div>
          <div className="bg-stone-900/50 rounded-xl p-4 border border-stone-800">
            <p className="text-sm text-stone-300 leading-relaxed">
              <strong className="text-red-400">Alert:</strong> Fall Armyworm swarm detected 50km South. Wind patterns indicate arrival at your farm in <span className="text-white font-bold">4-6 days</span>.
            </p>
          </div>
        </div>

        {/* Connection Logic */}
        <div className="flex flex-col items-center justify-center shrink-0 py-4 md:py-0 md:px-4">
          {step === 0 && (
            <button 
              onClick={() => setStep(1)}
              className="bg-stone-100 hover:bg-white text-stone-900 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
            >
              Correlate Data
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 1 && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-stone-800 rounded-full border border-stone-700 shadow-inner">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Scanning Fields</span>
            </div>
          )}
          {step >= 2 && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Correlated</span>
            </div>
          )}
        </div>

        {/* Agent 2: Crop Stress */}
        <div className={`flex-1 border p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden transition-all duration-700 ${
          step >= 2 ? 'bg-stone-800/50 border-emerald-500/30' : 'bg-stone-800/20 border-stone-700/30 opacity-60'
        }`}>
          <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-700 ${step >= 2 ? 'bg-emerald-500/50' : 'bg-stone-700'}`}></div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg transition-colors duration-700 ${step >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}>
              <Eye className="w-5 h-5" />
            </div>
            <h3 className={`font-bold transition-colors duration-700 ${step >= 2 ? 'text-stone-200' : 'text-stone-500'}`}>Crop Stress Early Warning</h3>
          </div>
          <div className={`rounded-xl p-4 border transition-all duration-700 ${step >= 2 ? 'bg-stone-900/50 border-stone-800' : 'bg-transparent border-transparent'}`}>
            {step < 2 ? (
              <p className="text-sm text-stone-500 italic text-center py-2">Awaiting trigger...</p>
            ) : (
              <p className="text-sm text-stone-300 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                <strong className="text-emerald-400">Analysis:</strong> Scanned SE Corn Field. Detected <span className="text-white font-bold">minor chlorophyll degradation</span> (invisible to naked eye). Field is highly vulnerable to incoming pest pressure.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Plan */}
      {step >= 2 && (
        <div className="mt-6 bg-emerald-950/30 border border-emerald-500/20 p-6 rounded-3xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-emerald-400 mb-2 text-lg">Preventative Action Plan</h4>
              <p className="text-sm text-stone-300 mb-6 leading-relaxed">
                The targeted field is already showing early stress, making it highly susceptible to the incoming Armyworm migration. Pre-emptive localized spraying is strongly recommended before the swarm arrives.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setStep(3)}
                  disabled={step === 3}
                  className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                    step === 3 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-stone-900 shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5'
                  }`}
                >
                  {step === 3 ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Drone Spray Scheduled (Tomorrow, 06:00)
                    </>
                  ) : (
                    'Schedule Preventative Spray (Spinetoram)'
                  )}
                </button>
                <button className="px-6 py-3 rounded-2xl font-bold text-sm bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition-all">
                  View Vulnerability Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelligenceHub() {
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2 flex items-center gap-3">
          <Brain className="w-8 h-8 text-emerald-600" />
          Intelligence Hub
        </h1>
        <p className="text-stone-500 max-w-3xl">
          Your farm's dedicated network of specialized agents. Each agent focuses on a specific aspect of your operation, learning and adapting to your unique farm conditions over time.
        </p>
      </div>

      <SynergyWorkflow />

      <div className="space-y-12">
        {agentCategories.map((category, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-2">
              <div className={`p-2 rounded-xl ${category.color}`}>
                <category.icon className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800">{category.title}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.agents.map((agent, agentIdx) => (
                <div key={agentIdx} className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-300 flex flex-col h-full group relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 ${category.color.split(' ')[0]}`}></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="p-3.5 rounded-2xl bg-stone-50 text-stone-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shadow-sm border border-stone-100 group-hover:border-emerald-100">
                      <agent.icon className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ${
                      agent.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      agent.status === 'Learning' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      agent.status === 'Beta' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                      'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-stone-800 mb-3 tracking-tight relative z-10">{agent.name}</h3>
                  <p className="text-sm text-stone-500 font-medium leading-relaxed flex-1 mb-8 relative z-10">
                    {agent.description}
                  </p>
                  
                  <button 
                    onClick={() => setSelectedAgent(agent)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-stone-100 text-stone-600 font-bold hover:bg-stone-50 hover:text-stone-900 hover:border-stone-200 transition-all mt-auto relative z-10 group-hover:shadow-sm"
                  >
                    View Insights
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Overlay */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-stone-200/50">
            
            {/* Modal Header */}
            <div className="p-8 border-b border-stone-100 flex justify-between items-start bg-gradient-to-b from-stone-50/80 to-white">
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner border border-emerald-200/50">
                  <selectedAgent.icon className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-extrabold text-stone-800 tracking-tight">{selectedAgent.name}</h2>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border ${
                      selectedAgent.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      selectedAgent.status === 'Learning' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      selectedAgent.status === 'Beta' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                      'bg-stone-100 text-stone-600 border-stone-200'
                    }`}>
                      {selectedAgent.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-stone-500 leading-relaxed">{selectedAgent.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAgent(null)}
                className="p-2.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <h3 className="text-lg font-bold text-stone-800">Latest Intelligence</h3>
              
              <div className="space-y-4">
                {selectedAgent.insights?.map((insight: any, idx: number) => (
                  <div key={idx} className={`p-4 rounded-2xl border flex gap-4 items-start ${
                    insight.type === 'alert' ? 'bg-red-50 border-red-100 text-red-900' :
                    insight.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                    'bg-blue-50 border-blue-100 text-blue-900'
                  }`}>
                    <div className="shrink-0 mt-0.5">
                      {insight.type === 'alert' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                      {insight.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {insight.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                    </div>
                    <p className="text-sm leading-relaxed font-medium">{insight.text}</p>
                  </div>
                ))}
              </div>

              {selectedAgent.status.includes("Required") && (
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 text-center space-y-3">
                  <p className="text-stone-600 font-medium">This agent requires additional setup to generate insights.</p>
                  <button className="bg-stone-800 text-white px-6 py-2 rounded-xl font-semibold hover:bg-stone-700 transition-colors">
                    Configure Agent
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedAgent(null)}
                className="px-6 py-2.5 rounded-xl font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
              >
                Close
              </button>
              <Link 
                to="/assistant"
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Chat with Agent
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

