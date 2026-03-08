"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Bot, User, Sparkles, ExternalLink, BarChart3, Trash2 } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

interface Ad {
  ad_id: string;
  title: string;
  text: string;
  relevance_score: number;
  bid_amount: number;
  final_score: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ad?: Ad | null;
  timestamp: Date;
}

interface SdkLog {
  id: string;
  time: string;
  type: "match" | "impression" | "click" | "error" | "info";
  message: string;
}

// ── Main Page ───────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLogs, setSdkLogs] = useState<SdkLog[]>([]);
  const [showPanel, setShowPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addLog = (type: SdkLog["type"], message: string) => {
    setSdkLogs((prev) => [
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
      ...prev,
    ].slice(0, 50));
  };

  // ── Send message ────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // 1. Get AI response
      addLog("info", `Sending prompt: "${prompt.slice(0, 60)}..."`);

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const { text, error: chatError } = await chatRes.json();
      if (chatError) throw new Error(chatError);

      addLog("info", `AI response received (${text.length} chars)`);

      // 2. Match ad via SDK (server-side proxy)
      addLog("match", `SDK getAd("${prompt.slice(0, 40)}...")`);

      let ad: Ad | null = null;
      try {
        const adRes = await fetch("/api/ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_prompt: prompt }),
        });
        const adData = await adRes.json();
        ad = adData.ad;

        if (ad) {
          addLog(
            "match",
            `✓ Ad matched: "${ad.title}" (relevance: ${ad.relevance_score}, final: ${ad.final_score})`
          );

          // 3. Track impression
          addLog("impression", `SDK trackImpression("${ad.ad_id.slice(0, 8)}...")`);
          await fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ad_id: ad.ad_id, event: "impression" }),
          });
          addLog("impression", `✓ Impression tracked`);
        } else {
          addLog("match", `No matching ad found`);
        }
      } catch (adErr: any) {
        addLog("error", `Ad match failed: ${adErr.message}`);
      }

      // 4. Add assistant message
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: text,
        ad,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      addLog("error", `Chat failed: ${err.message}`);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── Click tracking ──────────────────────────────────────────────

  const handleAdClick = async (ad: Ad) => {
    addLog("click", `SDK trackClick("${ad.ad_id.slice(0, 8)}...")`);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.ad_id, event: "click" }),
      });
      addLog("click", `✓ Click tracked for "${ad.title}"`);
    } catch (err: any) {
      addLog("error", `Click tracking failed: ${err.message}`);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Conversational AI Test</h1>
            <p className="text-xs text-[var(--muted)]">
              PromptAds SDK Integration Demo
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
        >
          <BarChart3 className="w-3 h-3" />
          {showPanel ? "Hide" : "Show"} SDK Logs
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h2 className="text-lg font-medium mb-2">
                  Start a Conversation
                </h2>
                <p className="text-sm text-[var(--muted)] max-w-md">
                  Chat with the AI and see PromptAds contextual ads appear
                  naturally in responses. Try topics like writing, coding, coffee, travel, etc.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {[
                    "Help me write a blog post",
                    "Best laptops for coding",
                    "How to brew great coffee",
                    "Tips for learning Python",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 text-xs rounded-full border border-[var(--border)] hover:bg-[var(--card)] hover:border-[var(--accent)] transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                <div
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--card)] border border-[var(--border)]"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-[var(--foreground)]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-[var(--foreground)]" />
                    </div>
                  )}
                </div>

                {/* Inline Ad Card */}
                {msg.ad && (
                  <div className="ml-10 mt-2 animate-fade-in">
                    <div className="ad-card-pulse max-w-[70%] rounded-xl border border-[var(--sponsored-border)]/30 bg-[var(--sponsored-bg)] p-3.5 transition-all hover:border-[var(--sponsored-border)]/60">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                          Sponsored
                        </span>
                        <span className="text-[10px] text-[var(--muted)] ml-auto">
                          relevance {(msg.ad.relevance_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {msg.ad.title}
                      </p>
                      <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
                        {msg.ad.text}
                      </p>
                      <button
                        onClick={() => handleAdClick(msg.ad!)}
                        className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
                      >
                        Learn more
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm">
                  <span className="cursor-blink">Thinking</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--border)] px-4 py-3 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 text-white rounded-xl px-4 py-2.5 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* SDK Logs Panel */}
        {showPanel && (
          <div className="w-80 border-l border-[var(--border)] flex flex-col shrink-0 bg-[#0c0c0c]">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                SDK Activity Log
              </h2>
              <button
                onClick={() => setSdkLogs([])}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 font-mono text-[11px]">
              {sdkLogs.length === 0 && (
                <p className="text-[var(--muted)] text-center py-8">
                  SDK events will appear here...
                </p>
              )}
              {sdkLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-2 py-1 border-b border-[var(--border)]/30 animate-fade-in"
                >
                  <span className="text-[var(--muted)] shrink-0">{log.time}</span>
                  <span
                    className={`shrink-0 px-1 rounded text-[10px] font-medium ${
                      log.type === "match"
                        ? "bg-purple-500/20 text-purple-400"
                        : log.type === "impression"
                        ? "bg-green-500/20 text-green-400"
                        : log.type === "click"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : log.type === "error"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {log.type}
                  </span>
                  <span className="text-[var(--foreground)]/80 break-words min-w-0">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
