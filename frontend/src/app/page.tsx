import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Target,
  BarChart3,
  Code2,
  Sparkles,
  Shield,
  Terminal,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">PromptAds AI</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#integration" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Integration
            </a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-24 text-center lg:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Open Source AI-Native Advertising
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Contextual Ads for{" "}
            <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              AI Applications
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Monetize your AI apps with non-intrusive, contextually relevant ads.
            Powered by semantic matching, bid-based ranking, and LLM-native ad
            rewriting.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="https://github.com/abhishekayu/promptads-ai"
              className="inline-flex items-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Code2 className="mr-2 h-4 w-4" /> View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* ── Demo ──────────────────────────────────────────── */}
      <section id="demo" className="container mx-auto px-4 pb-24">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <div className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-xs text-muted-foreground">AI Assistant</span>
          </div>
          <div className="space-y-4 p-6 text-sm">
            <div className="flex gap-3">
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">U</div>
              <p className="rounded-lg bg-muted px-4 py-2.5">&quot;best tools for building websites&quot;</p>
            </div>
            <div className="flex gap-3">
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <p className="mb-2">Here are some great tools for building websites:</p>
                  <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                    <li>Next.js — React framework for production</li>
                    <li>Webflow — Visual web development platform</li>
                    <li>Framer — Design and ship sites fast</li>
                  </ol>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    Sponsored
                  </div>
                  <p className="text-foreground">
                    Webflow allows developers to design and launch websites visually
                    without managing infrastructure.{" "}
                    <span className="font-medium text-primary cursor-pointer hover:underline">
                      Try Webflow free →
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="border-t border-border bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Built for the AI Era</h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              Everything you need to run contextual ads in AI applications —
              from semantic matching to real-time analytics.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Target className="h-5 w-5" />}
              title="Semantic Ad Matching"
              description="Ads are matched using vector embeddings and cosine similarity — not just keywords. Higher relevance, better UX."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="LLM Ad Rewriting"
              description="Ads are rewritten by GPT to naturally fit each response context. No jarring insertions."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="3-Line SDK Integration"
              description="Drop in the Python or TypeScript SDK and start showing contextual ads in minutes."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Real-time Analytics"
              description="Track impressions, clicks, CTR, and spend with a full analytics dashboard."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Privacy-First"
              description="No user tracking or profiling. Ads are matched to prompts, not people."
            />
            <FeatureCard
              icon={<Code2 className="h-5 w-5" />}
              title="Open Source"
              description="MIT licensed. Self-host or use the cloud. Full transparency on how ads are served."
            />
          </div>
        </div>
      </section>

      {/* ── Developer Integration ─────────────────────────── */}
      <section id="integration" className="border-t border-border py-24">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Developer Integration</h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              Add contextual ads to your AI app in three steps.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
            {/* Steps */}
            <div className="space-y-8">
              <Step
                number="1"
                title="Install the SDK"
                description="Install the PromptAds SDK via pip or npm."
              />
              <Step
                number="2"
                title="Match ads to prompts"
                description="Send the user's prompt to our matching engine. We return the most relevant ad with LLM-rewritten copy."
              />
              <Step
                number="3"
                title="Display and track"
                description="Render the sponsored result inline and call the analytics endpoint to track impressions & clicks."
              />
            </div>
            {/* Code sample */}
            <div className="overflow-hidden rounded-xl border border-border bg-[hsl(0_0%_5%)] shadow-xl">
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Python SDK</span>
              </div>
              <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
                <code className="text-muted-foreground">
                  <span className="text-purple-400">from</span> promptads <span className="text-purple-400">import</span> PromptAdsClient{"\n\n"}
                  <span className="text-muted-foreground/60"># Initialize client</span>{"\n"}
                  client = PromptAdsClient(api_key=<span className="text-emerald-400">&quot;sk-...&quot;</span>){"\n\n"}
                  <span className="text-muted-foreground/60"># Match an ad to the user&apos;s prompt</span>{"\n"}
                  result = client.match_ad({"\n"}
                  {"    "}user_prompt=<span className="text-emerald-400">&quot;best tools for building websites&quot;</span>{"\n"}
                  ){"\n\n"}
                  <span className="text-purple-400">print</span>(result.text){"\n"}
                  <span className="text-muted-foreground/60"># → Sponsored: Webflow allows developers to{"\n"}
                  #   design and launch websites visually...</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to monetize your AI app?</h2>
          <p className="mx-auto mb-10 max-w-md text-muted-foreground">
            Join the future of AI-native advertising. Free to start, open source
            forever.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Account <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="https://github.com/abhishekayu/promptads-ai"
              className="inline-flex items-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Code2 className="mr-2 h-4 w-4" /> Star on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>© 2026 PromptAds AI. MIT License.</span>
          </div>
          <div className="flex gap-6">
            <Link href="https://github.com/abhishekayu/promptads-ai" className="hover:text-foreground transition-colors">
              GitHub
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-primary/5">
      <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>
      <div>
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
