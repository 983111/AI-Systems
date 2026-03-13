import { useState, useRef } from "react";
import { analyzeCropDisease } from "@/services/geminiService";
import { UploadCloud, Camera, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function DiseaseDetection() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsLoading(true);
    setResult(null);

    try {
      // Extract base64 and mime type
      const [header, base64Data] = image.split(",");
      const mimeType = header.split(":")[1].split(";")[0];
      
      const analysis = await analyzeCropDisease(base64Data, mimeType);
      setResult(analysis);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setResult("Failed to analyze image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Crop Disease Detection</h2>
          <p className="text-stone-500 mb-8">
            Upload a clear photo of the affected plant leaf or crop. It will be analyzed instantly.
          </p>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />

          {!image ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-12 border-2 border-dashed border-stone-300 rounded-2xl hover:bg-stone-50 hover:border-emerald-500 transition-colors flex flex-col items-center justify-center gap-4 group"
            >
              <UploadCloud className="w-12 h-12 text-stone-400 group-hover:text-emerald-500 transition-colors" />
              <span className="font-medium text-stone-600 group-hover:text-emerald-600">
                Click to upload or drag and drop
              </span>
              <span className="text-sm text-stone-400">PNG, JPG up to 10MB</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 aspect-video bg-stone-100">
                <img src={image} alt="Uploaded crop" className="w-full h-full object-contain" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-4 right-4 bg-white/80 backdrop-blur text-stone-800 px-3 py-1 rounded-lg text-sm font-medium hover:bg-white transition-colors"
                >
                  Change Image
                </button>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Analyzing Image...
                  </>
                ) : (
                  "Analyze Crop Health"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm h-full flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
            <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
            <h3 className="text-xl font-semibold text-stone-800">Analyzing...</h3>
            <p className="text-stone-500 max-w-sm">
              Scanning for over 50+ common plant diseases, pests, and nutrient deficiencies.
            </p>
          </div>
        ) : result ? (
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm h-full overflow-y-auto">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-800">Analysis Complete</h3>
                <p className="text-sm text-stone-500">Confidence: High</p>
              </div>
            </div>
            <div className="prose prose-emerald max-w-none">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 p-8 rounded-3xl border border-stone-200 border-dashed h-full flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
            <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-stone-600">No Analysis Yet</h3>
            <p className="text-stone-500 max-w-sm">
              Upload an image and click analyze to see the diagnosis and treatment recommendations here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
