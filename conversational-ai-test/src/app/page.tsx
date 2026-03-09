"use client";

import { useState, useRef, useEffect, useCallback, FormEvent, KeyboardEvent } from "react";
import { Send, Bot, User, Trash2, Zap, ArrowRight, Activity, Radio, PanelLeftClose, PanelLeft, Plus, ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  ads?: Ad[];
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "0";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [input]);

  const addLog = (type: SdkLog["type"], message: string) => {
    setSdkLogs((prev) => [
      { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), type, message },
      ...prev,
    ].slice(0, 100));
  };

  const readStream = useCallback(
    async (
      res: Response,
      onChunk: (text: string) => void
    ): Promise<string> => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        onChunk(chunk);
      }
      return full;
    },
    []
  );

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
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

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    const updateMsg = (updater: (prev: Message) => Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...updater(m) } : m))
      );
    };

    try {
      addLog("info", "Sending prompt: \"" + prompt.slice(0, 60) + "...\"");

      const chatPromise = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const adsPromise = (async (): Promise<Ad[]> => {
        try {
          addLog("match", "SDK getAds(\"" + prompt.slice(0, 40) + "...\")");
          const adRes = await fetch("/api/ad", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_prompt: prompt }),
          });
          const adData = await adRes.json();
          const ads: Ad[] = adData.ads || [];
          if (ads.length > 0) {
            addLog("match", "Matched " + ads.length + " ads: " + ads.map((a: Ad) => '"' + a.title + '"').join(", "));
          } else {
            addLog("match", "No matching ads found");
          }
          return ads;
        } catch (adErr: any) {
          addLog("error", "Ad match failed: " + adErr.message);
          return [];
        }
      })();

      const chatRes = await chatPromise;
      if (!chatRes.ok) {
        const errData = await chatRes.json().catch(() => ({}));
        throw new Error(errData.error || "Chat request failed");
      }

      addLog("info", "Streaming response...");
      const chatText = await readStream(chatRes, (chunk) => {
        updateMsg((m) => ({ content: m.content + chunk }));
      });
      addLog("info", "Response complete (" + chatText.length + " chars)");

      const ads = await adsPromise;

      if (ads.length > 0) {
        try {
          addLog("info", "Adding " + ads.length + " recommendations...");
          const blendRes = await fetch("/api/blend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aiResponse: chatText, ads }),
          });

          if (blendRes.ok && blendRes.body) {
            updateMsg((m) => ({ content: m.content + "\n\n" }));
            const appendedText = await readStream(blendRes, (chunk) => {
              updateMsg((m) => ({ content: m.content + chunk }));
            });
            if (appendedText) {
              addLog("info", "Recommendations added (" + appendedText.length + " chars)");
            }
          }
        } catch (blendErr: any) {
          addLog("error", "Recommendation failed: " + blendErr.message);
        }

        updateMsg(() => ({ ads }));
        for (const ad of ads) {
          addLog("impression", "trackImpression(\"" + ad.ad_id.slice(0, 8) + "...\")");
          fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ad_id: ad.ad_id, event: "impression" }),
          })
            .then(() => addLog("impression", "Impression tracked for \"" + ad.title + "\""))
            .catch(() => {});
        }
      }
    } catch (err: any) {
      addLog("error", "Chat failed: " + err.message);
      updateMsg(() => ({
        content: "Sorry, something went wrong. Please try again.",
      }));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const logIcons: Record<string, string> = {
    match: "🎯",
    impression: "👁",
    click: "🖱",
    error: "❌",
    info: "ℹ️",
  };

  const logDotColors: Record<string, string> = {
    match: "var(--accent)",
    impression: "var(--green)",
    click: "var(--amber)",
    error: "var(--red)",
    info: "var(--blue)",
  };

  return (
    <div className="h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* ── Left Sidebar: SDK Logs (like GPT history) ── */}
      <aside
        className={
          "sidebar-animate flex flex-col shrink-0 " +
          (sidebarOpen ? "w-[280px]" : "w-0")
        }
        style={{ background: "var(--bg-secondary)", overflow: "hidden" }}
      >
        <div className="flex flex-col h-full min-w-[280px]">
          {/* Sidebar header */}
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ color: "var(--foreground-muted)" }}
              title="Close sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setMessages([]); setSdkLogs([]); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ color: "var(--foreground-muted)" }}
              title="New chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Logs title */}
          <div className="px-4 py-2 flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--foreground-muted)" }}>
              SDK Logs
            </span>
            {sdkLogs.length > 0 && (
              <span
                className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {sdkLogs.length}
              </span>
            )}
          </div>

          {/* Logs list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 sidebar-scroll">
            {sdkLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Radio className="w-6 h-6 mb-3 opacity-20" style={{ color: "var(--foreground)" }} />
                <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  SDK events will appear here as you chat.
                </p>
              </div>
            )}
            {sdkLogs.map((log) => (
              <div
                key={log.id}
                className="log-item group flex items-start gap-2.5 px-3 py-2.5 rounded-lg animate-fade-in cursor-default"
              >
                {/* Dot indicator */}
                <span
                  className="w-2 h-2 rounded-full mt-1 shrink-0"
                  style={{ background: logDotColors[log.type] || "var(--foreground-subtle)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: logDotColors[log.type] || "var(--foreground-muted)" }}
                    >
                      {log.type}
                    </span>
                    <span className="text-[9px] ml-auto shrink-0" style={{ color: "var(--foreground-subtle)" }}>
                      {log.time}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-snug break-words" style={{ color: "var(--foreground-muted)" }}>
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar footer: clear logs */}
          {sdkLogs.length > 0 && (
            <div className="px-3 pb-3 pt-1">
              <button
                onClick={() => setSdkLogs([])}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-colors"
                style={{ color: "var(--foreground-muted)", background: "var(--bg-tertiary)" }}
              >
                <Trash2 className="w-3 h-3" />
                Clear logs
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Top bar */}
        <div className="h-12 flex items-center px-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity mr-2"
              style={{ color: "var(--foreground-muted)" }}
              title="Open sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}
          {!sidebarOpen && (
            <button
              onClick={() => { setMessages([]); setSdkLogs([]); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity mr-3"
              style={{ color: "var(--foreground-muted)" }}
              title="New chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            PromptAds AI
          </span>
          <span className="ml-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--foreground-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--green)" }} />
            SDK Active
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty state — GPT-style centered prompt */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--accent-muted)" }}>
                <Zap className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                PromptAds AI Demo
              </h1>
              <p className="text-sm mb-10 max-w-md text-center" style={{ color: "var(--foreground-muted)" }}>
                Chat naturally. Contextual ads appear only when relevant.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
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
                      textareaRef.current?.focus();
                    }}
                    className="suggestion-chip flex items-center gap-3 px-4 py-3.5 text-left text-[13px] rounded-xl transition-all"
                    style={{ background: "var(--bg-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="animate-fade-in">
                  {/* Message row — GPT style */}
                  <div className="flex gap-4 items-start">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: msg.role === "assistant" ? "var(--accent)" : "var(--bg-elevated)",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <Bot className="w-4 h-4 text-white" />
                      ) : (
                        <User className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                          {msg.role === "assistant" ? "PromptAds AI" : "You"}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--foreground-subtle)" }}>
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {msg.role === "assistant" ? (
                        <div className="markdown-body text-[14px] leading-[1.7]" style={{ color: "var(--foreground)" }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                          {isLoading && messages[messages.length - 1]?.id === msg.id && !msg.content && (
                            <div className="flex gap-1 py-2">
                              <span className="dot-1 w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                              <span className="dot-2 w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                              <span className="dot-3 w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                            </div>
                          )}
                          {isLoading && messages[messages.length - 1]?.id === msg.id && msg.content && (
                            <span className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom animate-pulse" style={{ background: "var(--accent)" }} />
                          )}
                        </div>
                      ) : (
                        <div className="text-[14px] leading-[1.7] whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                          {msg.content}
                        </div>
                      )}

                      {/* Ad recommendations */}
                      {msg.ads && msg.ads.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
                          {msg.ads.map((ad) => (
                            <button
                              key={ad.ad_id}
                              onClick={() => handleAdClick(ad)}
                              className="ad-card inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
                              style={{
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {ad.image_url && (
                                <img src={ad.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                              )}
                              <div className="text-left">
                                <p className="text-[12px] font-medium leading-tight" style={{ color: "var(--foreground)" }}>
                                  {ad.title}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                                  Learn more →
                                </p>
                              </div>
                              <ArrowRight
                                className="w-3.5 h-3.5 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                                style={{ color: "var(--accent)" }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input area — GPT-style textarea ── */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div
                className="chat-input-box relative flex items-end rounded-2xl transition-all"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message PromptAds AI..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent resize-none px-4 py-3.5 text-[14px] outline-none disabled:opacity-50 placeholder:opacity-40 leading-[1.5]"
                  style={{ color: "var(--foreground)", maxHeight: "200px" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="m-2 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-20"
                  style={{
                    background: input.trim() ? "var(--accent)" : "var(--foreground-subtle)",
                    color: "#fff",
                  }}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </form>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--foreground-subtle)" }}>
              PromptAds AI can make mistakes. Ads are matched via semantic embeddings.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
