import { CloudSun, CloudRain, Wind, Droplets, MapPin, Navigation } from "lucide-react";

export default function Weather() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Weather & Satellite</h1>
          <p className="text-stone-500">Hyper-local weather prediction and field monitoring.</p>
        </div>
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full font-medium">
          <MapPin className="w-5 h-5" />
          <span>Pune, Maharashtra</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/4"></div>
            
            <div className="flex justify-between items-start relative z-10 mb-12">
              <div>
                <p className="text-sky-100 font-medium mb-1">Current Weather</p>
                <h2 className="text-6xl font-bold tracking-tighter">28°C</h2>
                <p className="text-xl font-medium mt-2">Partly Cloudy</p>
              </div>
              <CloudSun className="w-24 h-24 text-white/90" />
            </div>

            <div className="grid grid-cols-3 gap-4 relative z-10 border-t border-white/20 pt-6">
              <div className="flex items-center gap-3">
                <Droplets className="w-6 h-6 text-sky-200" />
                <div>
                  <p className="text-sm text-sky-100">Humidity</p>
                  <p className="font-semibold">65%</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wind className="w-6 h-6 text-sky-200" />
                <div>
                  <p className="text-sm text-sky-100">Wind</p>
                  <p className="font-semibold">12 km/h</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CloudRain className="w-6 h-6 text-sky-200" />
                <div>
                  <p className="text-sm text-sky-100">Rain Prob.</p>
                  <p className="font-semibold">10%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="text-xl font-bold text-stone-800 mb-6">7-Day Forecast</h3>
            <div className="space-y-4">
              {[
                { day: "Today", temp: "28° / 22°", icon: CloudSun, desc: "Partly Cloudy" },
                { day: "Tomorrow", temp: "29° / 23°", icon: CloudSun, desc: "Sunny" },
                { day: "Wednesday", temp: "26° / 21°", icon: CloudRain, desc: "Light Rain" },
                { day: "Thursday", temp: "25° / 20°", icon: CloudRain, desc: "Showers" },
                { day: "Friday", temp: "27° / 21°", icon: CloudSun, desc: "Clearing" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100">
                  <div className="w-24 font-medium text-stone-800">{item.day}</div>
                  <div className="flex items-center gap-4 flex-1">
                    <item.icon className="w-6 h-6 text-stone-400" />
                    <span className="text-stone-500">{item.desc}</span>
                  </div>
                  <div className="font-semibold text-stone-800">{item.temp}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-stone-800">Satellite Imagery</h3>
              <button className="text-emerald-600 bg-emerald-50 p-2 rounded-lg hover:bg-emerald-100 transition-colors">
                <Navigation className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4">
              <button className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg">NDVI</button>
              <button className="flex-1 bg-stone-100 text-stone-600 hover:bg-stone-200 text-xs font-bold py-2 rounded-lg transition-colors">Moisture</button>
              <button className="flex-1 bg-stone-100 text-stone-600 hover:bg-stone-200 text-xs font-bold py-2 rounded-lg transition-colors">Thermal</button>
            </div>
            
            <div className="aspect-square rounded-2xl overflow-hidden relative mb-6 bg-stone-100 group">
              <img 
                src="https://picsum.photos/seed/farmview/600/600" 
                alt="Satellite map" 
                className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-2xl m-8 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Vegetation Index</span>
                  <span className="text-sm font-bold text-emerald-600">0.75 (Healthy)</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2">
                  <div className="bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 h-1.5 rounded-full" style={{ width: '75%' }}></div>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-200/60">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">NDVI Data</span>
                  <span className="text-sm font-bold text-stone-800">0.75</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-500 font-medium">Last Updated</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-sm font-bold text-stone-800">Today, 14:30 IST</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-sm text-stone-500 font-medium">Cloud Cover</span>
                <span className="text-sm font-bold text-stone-800">12% (Clear)</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl">
            <h4 className="font-bold text-amber-800 mb-2">Weather Alert</h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              Based on the upcoming rain forecast on Wednesday, we recommend delaying pesticide application until Friday to prevent runoff.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
