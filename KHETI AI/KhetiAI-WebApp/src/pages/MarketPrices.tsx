import { useState, useEffect } from "react";
import { getMarketForecast } from "@/services/geminiService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, Loader2, Search } from "lucide-react";

export default function MarketPrices() {
  const [crop, setCrop] = useState("Soybean");
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchForecast(crop);
  }, [crop]);

  const fetchForecast = async (cropName: string) => {
    setIsLoading(true);
    try {
      const result = await getMarketForecast(cropName);
      setData(result);
    } catch (error) {
      console.error("Error fetching forecast:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setCrop(searchInput.trim());
      setSearchInput("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Market Price Forecasting</h1>
          <p className="text-stone-500">Price predictions for the next 3 months.</p>
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full md:w-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search crop (e.g., Wheat, Cotton)"
            className="w-full md:w-80 pl-12 pr-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        </form>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
          <p className="text-lg font-medium text-stone-600">Analyzing market trends for {crop}...</p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-stone-800 capitalize">{crop} Forecast</h2>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100">
                <span className="text-sm font-medium text-stone-600">Current Price:</span>
                <span className="text-lg font-bold text-stone-900">₹{data.currentPrice}/q</span>
              </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.forecast} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value}`, 'Price']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#059669" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#059669', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="text-lg font-semibold text-stone-800 mb-6">Trend Analysis</h3>
              
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                  data.trend === 'up' ? 'bg-emerald-100 text-emerald-600' :
                  data.trend === 'down' ? 'bg-red-100 text-red-600' :
                  'bg-stone-100 text-stone-600'
                }`}>
                  {data.trend === 'up' ? <TrendingUp className="w-8 h-8" /> :
                   data.trend === 'down' ? <TrendingDown className="w-8 h-8" /> :
                   <Minus className="w-8 h-8" />}
                </div>
                <div>
                  <p className="text-sm text-stone-500 font-medium uppercase tracking-wider mb-1">Overall Trend</p>
                  <p className={`text-2xl font-bold capitalize ${
                    data.trend === 'up' ? 'text-emerald-600' :
                    data.trend === 'down' ? 'text-red-600' :
                    'text-stone-600'
                  }`}>
                    {data.trend}ward
                  </p>
                </div>
              </div>

              <div className="prose prose-sm text-stone-600">
                <p>{data.analysis}</p>
              </div>
            </div>

            <div className="bg-emerald-700 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600 rounded-full blur-2xl opacity-50 -translate-y-1/2 translate-x-1/4"></div>
              <h3 className="text-lg font-semibold mb-4 relative z-10">Vendor Matching</h3>
              <p className="text-emerald-100 text-sm mb-6 relative z-10">
                Based on current prices, we found 3 buyers willing to purchase {crop} above market rate.
              </p>
              <button className="w-full bg-white text-emerald-800 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition-colors relative z-10">
                View Buyers
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-sm text-center">
          <p className="text-lg text-stone-500">Failed to load market data. Please try again.</p>
        </div>
      )}
    </div>
  );
}
