import { useState } from "react";
import { Landmark, CheckCircle2, FileText, Calculator, ArrowRight } from "lucide-react";

export default function LoanEligibility() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    landSize: "",
    cropType: "",
    annualIncome: "",
    existingLoans: "no",
  });

  const handleNext = () => setStep(2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Loan Eligibility Check</h1>
        <p className="text-stone-500">Find the best agricultural loans and subsidies for your farm.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            {step === 1 ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xl">1</div>
                  <h2 className="text-2xl font-bold text-stone-800">Farm Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Land Size (Acres)</label>
                    <input 
                      type="number" 
                      value={formData.landSize}
                      onChange={(e) => setFormData({...formData, landSize: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Primary Crop Type</label>
                    <select 
                      value={formData.cropType}
                      onChange={(e) => setFormData({...formData, cropType: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Select Crop</option>
                      <option value="wheat">Wheat</option>
                      <option value="rice">Rice / Paddy</option>
                      <option value="cotton">Cotton</option>
                      <option value="sugarcane">Sugarcane</option>
                      <option value="soybean">Soybean</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Estimated Annual Income (₹)</label>
                    <input 
                      type="number" 
                      value={formData.annualIncome}
                      onChange={(e) => setFormData({...formData, annualIncome: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. 300000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Existing Loans?</label>
                    <select 
                      value={formData.existingLoans}
                      onChange={(e) => setFormData({...formData, existingLoans: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button 
                    onClick={handleNext}
                    disabled={!formData.landSize || !formData.cropType || !formData.annualIncome}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Check Eligibility
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-stone-800">Eligibility Results</h2>
                    <p className="text-stone-500">Based on your profile, you are eligible for the following:</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-emerald-900 mb-1">Kisan Credit Card (KCC)</h3>
                          <p className="text-emerald-700 font-medium">Pre-approved up to ₹3,00,000</p>
                        </div>
                        <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Top Match</span>
                      </div>
                      <ul className="space-y-2 mb-6 text-emerald-800 text-sm">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Interest rate: 4% p.a. (with prompt repayment)</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No collateral required up to ₹1.6 Lakh</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Flexible repayment linked to harvest season</li>
                      </ul>
                      <button className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors text-sm">
                        Apply Now
                      </button>
                    </div>
                  </div>

                  <div className="border border-stone-200 rounded-2xl p-6 hover:border-emerald-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-stone-800 mb-1">PM-KISAN Samman Nidhi</h3>
                        <p className="text-stone-500 font-medium">Income Support Scheme</p>
                      </div>
                    </div>
                    <ul className="space-y-2 mb-6 text-stone-600 text-sm">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> ₹6,000 per year in 3 equal installments</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Direct Benefit Transfer (DBT)</li>
                    </ul>
                    <button className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors text-sm flex items-center gap-1">
                      Check Status <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100">
                  <button 
                    onClick={() => setStep(1)}
                    className="text-stone-500 font-medium hover:text-stone-800 transition-colors"
                  >
                    ← Back to Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-stone-600" />
              <h3 className="font-bold text-stone-800">Required Documents</h3>
            </div>
            <ul className="space-y-3 text-sm text-stone-600">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></div>
                Aadhaar Card
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></div>
                PAN Card
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></div>
                Land Ownership Records (7/12 Extract)
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></div>
                Recent Passport Size Photos
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 shrink-0"></div>
                Bank Passbook Copy
              </li>
            </ul>
          </div>

          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="w-6 h-6 text-indigo-600" />
              <h3 className="font-bold text-indigo-900">EMI Calculator</h3>
            </div>
            <p className="text-sm text-indigo-700 mb-4">
              Estimate your monthly installments before applying for a loan.
            </p>
            <button className="w-full bg-white text-indigo-600 py-2.5 rounded-xl font-semibold border border-indigo-200 hover:bg-indigo-100 transition-colors text-sm">
              Open Calculator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
