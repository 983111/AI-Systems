import { useState, useRef, useEffect } from "react";
import { askAgriAgent } from "@/services/geminiService";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function Assistant() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: "Namaste! I am your farm assistant. How can I help you today with weather, crops, prices, or loans?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const context = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join("\n");
      const response = await askAgriAgent(userMessage, context);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      console.error("Error asking agent:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I am having trouble connecting right now. Please try again later." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-multiply pointer-events-none"></div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-4 max-w-[80%] ${
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "assistant"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {msg.role === "assistant" ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div
              className={`p-4 rounded-3xl shadow-sm ${
                msg.role === "user"
                  ? "bg-emerald-600 text-white rounded-tr-sm"
                  : "bg-stone-50 border border-stone-200/60 text-stone-800 rounded-tl-sm prose prose-sm max-w-none"
              }`}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-[80%]">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 text-stone-800 rounded-tl-none flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-sm text-stone-500">Assistant is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-stone-200 relative z-10">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about fertilizers, weather, or crop prices..."
            className="flex-1 bg-stone-50 border border-stone-200 rounded-full px-6 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm text-stone-800"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-emerald-600 text-white px-8 py-3.5 rounded-full font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <Send className="w-5 h-5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
