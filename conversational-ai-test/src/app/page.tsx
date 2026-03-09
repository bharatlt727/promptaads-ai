"use client";

import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import { Send, Bot, User, Trash2, MessageCircle, Zap, ArrowRight, Activity, Radio } from "lucide-react";
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

  // Helper: read a fetch Response stream and call onChunk with each text piece
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

    // Create a placeholder assistant message that we'll stream into
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);

    // Helper to update the streaming message
    const updateMsg = (updater: (prev: Message) => Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, ...updater(m) } : m
        )
      );
    };

    try {
      addLog("info", "Sending prompt: \"" + prompt.slice(0, 60) + "...\"");

      // Start chat stream AND ad fetch in parallel
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
          addLog("match", "SDK getAds(\"" + prompt.slice(0, 40) + "...\")" );
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

      // Stream the full chat response to the UI immediately
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

      // Wait for ads result (likely already resolved since it ran in parallel)
      const ads = await adsPromise;

      if (ads.length > 0) {
        // Append a natural recommendation at the end of the full response
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

        // Track impressions + attach ads to message
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
                      className={"max-w-[75%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed" + (msg.role === "assistant" ? " prose-msg" : "")}
                      style={
                        msg.role === "user"
                          ? { background: "var(--accent)", color: "#fff" }
                          : {
                              background: "var(--bg-elevated)",
                              color: "var(--foreground)",
                            }
                      }
                    >
                      {msg.role === "assistant" ? (
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                          {isLoading && messages[messages.length - 1]?.id === msg.id && (
                            <span className="inline-block w-[2px] h-[14px] ml-0.5 align-text-bottom animate-pulse" style={{ background: "var(--accent)" }} />
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
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

                  {/* Subtle product recommendations — looks like natural resources */}
                  {msg.ads && msg.ads.length > 0 && (
                    <div className="ml-10 mt-2 flex flex-wrap gap-2 animate-fade-in">
                      {msg.ads.map((ad) => (
                        <button
                          key={ad.ad_id}
                          onClick={() => handleAdClick(ad)}
                          className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] group"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {ad.image_url && (
                            <img
                              src={ad.image_url}
                              alt=""
                              className="w-8 h-8 rounded-md object-cover shrink-0"
                            />
                          )}
                          <div className="text-left">
                            <p
                              className="text-[12px] font-medium leading-tight"
                              style={{ color: "var(--foreground)" }}
                            >
                              {ad.title}
                            </p>
                            <p
                              className="text-[10px] mt-0.5"
                              style={{ color: "var(--foreground-muted)" }}
                            >
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
              ))}

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
