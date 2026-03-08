"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Bot, User, Sparkles, Trash2, MessageCircle, Zap, ArrowRight, Activity, Radio } from "lucide-react";

// types
interface Ad {
  ad_id: string;
  title: string;
  description: string;
  text: string;
  product_url: string;
  image_url?: string | null;
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
      { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), type, message },
      ...prev,
    ].slice(0, 50));
  };

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
      addLog("info", "Sending prompt: \"" + prompt.slice(0, 60) + "...\"");
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
      addLog("info", "AI response received (" + text.length + " chars)");
      addLog("match", "SDK getAd(\"" + prompt.slice(0, 40) + "...\")");

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
          addLog("match", "Matched: \"" + ad.title + "\" (relevance: " + (ad.relevance_score * 100).toFixed(0) + "%)");
          addLog("impression", "trackImpression(\"" + ad.ad_id.slice(0, 8) + "...\")");
          await fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ad_id: ad.ad_id, event: "impression" }),
          });
          addLog("impression", "Impression tracked");
        } else {
          addLog("match", "No matching ad found");
        }
      } catch (adErr: any) {
        addLog("error", "Ad match failed: " + adErr.message);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: text,
          ad,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      addLog("error", "Chat failed: " + err.message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleAdClick = async (ad: Ad) => {
    addLog("click", "trackClick(\"" + ad.ad_id.slice(0, 8) + "...\")");
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: ad.ad_id, event: "click" }),
      });
      addLog("click", "Click tracked for \"" + ad.title + "\"");
    } catch (err: any) {
      addLog("error", "Click tracking failed: " + err.message);
    }
    if (ad.product_url)
      window.open(ad.product_url, "_blank", "noopener,noreferrer");
  };

  const logColors: Record<string, string> = {
    match: "bg-[var(--accent-muted)] text-[var(--accent)]",
    impression: "bg-[var(--green-muted)] text-[var(--green)]",
    click: "bg-[var(--amber-muted)] text-[var(--amber)]",
    error: "bg-[var(--red-muted)] text-[var(--red)]",
    info: "bg-[var(--blue-muted)] text-[var(--blue)]",
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        className="px-5 py-3 flex items-center justify-between shrink-0"
        style={{
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Conversational AI
            </h1>
            <p
              className="text-[11px] flex items-center gap-1.5"
              style={{ color: "var(--foreground-muted)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "var(--green)" }}
              />
              PromptAds SDK Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMessages([]);
              setSdkLogs([]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors"
            style={{
              color: "var(--foreground-muted)",
              background: "var(--bg-tertiary)",
            }}
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors"
            style={{
              color: showPanel ? "var(--accent)" : "var(--foreground-muted)",
              background: showPanel
                ? "var(--accent-muted)"
                : "var(--bg-tertiary)",
            }}
          >
            <Activity className="w-3 h-3" /> Logs
            {sdkLogs.length > 0 && (
              <span
                className="ml-0.5 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{ background: "var(--accent)" }}
              >
                {sdkLogs.length > 9 ? "9+" : sdkLogs.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "var(--accent-muted)" }}
                >
                  <Zap
                    className="w-7 h-7"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
                <h2
                  className="text-xl font-semibold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  PromptAds AI Demo
                </h2>
                <p
                  className="text-[13px] leading-relaxed mb-8 max-w-sm"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Chat naturally and see contextual ads matched by AI
                  embeddings. Ads appear only when relevant to your
                  conversation.
                </p>
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  {[
                    { text: "Help me write a blog post", icon: "✍️" },
                    { text: "Best laptops for coding", icon: "💻" },
                    { text: "How to brew great coffee", icon: "☕" },
                    { text: "Tips for learning Python", icon: "🐍" },
                  ].map((item) => (
                    <button
                      key={item.text}
                      onClick={() => {
                        setInput(item.text);
                        inputRef.current?.focus();
                      }}
                      className="suggestion-btn flex items-center gap-2.5 px-3.5 py-3 text-left text-[13px] rounded-xl transition-all"
                      style={{
                        background: "var(--bg-secondary)",
                        color: "var(--foreground)",
                      }}                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="font-medium">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-w-5xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="animate-fade-in">
                  <div
                    className={
                      "flex gap-2.5 " +
                      (msg.role === "user" ? "justify-end" : "justify-start")
                    }
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "var(--accent-muted)" }}
                      >
                        <Bot
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--accent)" }}
                        />
                      </div>
                    )}
                    <div
                      className="max-w-[75%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                      style={
                        msg.role === "user"
                          ? { background: "var(--accent)", color: "#fff" }
                          : {
                              background: "var(--bg-elevated)",
                              color: "var(--foreground)",
                            }
                      }
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div
                        className="text-[10px] mt-1.5"
                        style={{
                          color:
                            msg.role === "user"
                              ? "rgba(255,255,255,0.5)"
                              : "var(--foreground-subtle)",
                        }}
                      >
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: "var(--bg-elevated)",
                        }}
                      >
                        <User
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--foreground-muted)" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Ad Card */}
                  {msg.ad && (
                    <div className="ml-10 mt-2.5 animate-fade-in">
                      <div
                        className="ad-gradient-border ad-shimmer relative max-w-[75%] rounded-xl overflow-hidden"
                        style={{ background: "var(--bg-elevated)" }}
                      >
                        {msg.ad.image_url && (
                          <div
                            className="w-full h-32 overflow-hidden"
                          >
                            <img
                              src={msg.ad.image_url}
                              alt={msg.ad.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-3.5">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles
                              className="w-3 h-3"
                              style={{ color: "var(--accent)" }}
                            />
                            <span
                              className="text-[9px] font-semibold uppercase tracking-[0.1em]"
                              style={{ color: "var(--accent)" }}
                            >
                              Sponsored
                            </span>
                            <span
                              className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                background: "var(--accent-muted)",
                                color: "var(--accent)",
                              }}
                            >
                              {(msg.ad.relevance_score * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <p
                            className="text-[13px] font-semibold mb-1"
                            style={{ color: "var(--foreground)" }}
                          >
                            {msg.ad.title}
                          </p>
                          <p
                            className="text-[12px] leading-relaxed mb-3"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {msg.ad.description || msg.ad.text}
                          </p>
                          <button
                            onClick={() => handleAdClick(msg.ad!)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-white rounded-lg transition-all group"
                            style={{ background: "var(--accent)" }}
                          >
                            Learn more{" "}
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5 animate-fade-in">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-muted)" }}
                  >
                    <Bot
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--accent)" }}
                    />
                  </div>
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <div className="flex gap-1 items-center">
                      <div
                        className="w-1.5 h-1.5 rounded-full dot-1"
                        style={{ background: "var(--accent)" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full dot-2"
                        style={{ background: "var(--accent)" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full dot-3"
                        style={{ background: "var(--accent)" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            className="px-4 py-3 shrink-0"
            style={{
              background: "var(--bg-secondary)",
            }}
          >
            <form
              onSubmit={handleSubmit}
              className="flex gap-2.5 max-w-2xl mx-auto"
            >
              <div
                className="flex-1 input-glow rounded-xl transition-all flex items-center"
                style={{
                  background: "var(--bg-tertiary)",
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent px-4 py-2.5 text-[13px] outline-none disabled:opacity-50 placeholder:opacity-40"
                  style={{ color: "var(--foreground)" }}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-xl px-4 py-2.5 transition-all disabled:opacity-20"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* SDK Logs Panel */}
        {showPanel && (
          <div
            className="w-72 flex flex-col shrink-0"
            style={{
              background: "var(--bg-secondary)",
            }}
          >
            <div
              className="px-3.5 py-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Activity
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--accent)" }}
                />
                <h2
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  SDK Activity
                </h2>
              </div>
              <button
                onClick={() => setSdkLogs([])}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                style={{ color: "var(--foreground-subtle)" }}
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1">
              {sdkLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Radio
                    className="w-5 h-5 mb-2"
                    style={{ color: "var(--foreground-subtle)" }}
                  />
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--foreground-subtle)" }}
                  >
                    Waiting for events...
                  </p>
                </div>
              )}
              {sdkLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 py-2 px-2.5 rounded-lg animate-fade-in"
                  style={{
                    background: "var(--bg-tertiary)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={
                        "log-badge shrink-0 px-1.5 py-0.5 rounded " +
                        (logColors[log.type] || "")
                      }
                    >
                      {log.type}
                    </span>
                    <span
                      className="text-[9px] ml-auto shrink-0"
                      style={{ color: "var(--foreground-subtle)" }}
                    >
                      {log.time}
                    </span>
                  </div>
                  <span
                    className="text-[11px] break-words leading-relaxed"
                    style={{ color: "var(--foreground-muted)" }}
                  >
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
