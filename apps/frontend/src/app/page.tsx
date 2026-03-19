import Link from 'next/link';
import {
  Zap,
  Workflow,
  Globe,
  Mail,
  Clock,
  Send,
  Database,
  Shuffle,
  BarChart3,
  Shield,
  ArrowRight,
  Play,
  CheckCircle2,
  Layers,
  Bot,
} from 'lucide-react';

const triggers = [
  { icon: Globe, name: 'Webhook', desc: 'Instant trigger via HTTP request' },
  { icon: Clock, name: 'Schedule (Cron)', desc: 'Auto-run on a time schedule' },
  { icon: Mail, name: 'Email', desc: 'Trigger on incoming email' },
  { icon: Send, name: 'Telegram', desc: 'React to Telegram bot commands' },
];

const actions = [
  { icon: Globe, name: 'HTTP Request', desc: 'Call any REST API' },
  { icon: Mail, name: 'Email', desc: 'Send email notifications' },
  { icon: Send, name: 'Telegram', desc: 'Send Telegram messages' },
  { icon: Database, name: 'Database', desc: 'Read & write to DB' },
  { icon: Shuffle, name: 'Transform', desc: 'Reshape data between steps' },
  { icon: Bot, name: 'AI (OpenAI, etc.)', desc: 'Chat completions & more' },
];

const features = [
  {
    icon: Workflow,
    title: 'Visual Editor',
    desc: 'Drag & drop workflow builder — no code required',
  },
  {
    icon: BarChart3,
    title: 'Monitoring & Logs',
    desc: 'Detailed step-by-step logs and execution statistics',
  },
  {
    icon: Shield,
    title: 'Error Handling',
    desc: 'Automatic retry, notifications, and pause on failure',
  },
  {
    icon: Layers,
    title: 'Task Queue',
    desc: 'BullMQ + Redis for reliable workflow processing',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">FlowForge</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Get Started Free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-violet-400/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-6">
            <Play className="h-3 w-3" />
            Workflow Automation Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Automate everything.{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              No code.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Visual workflow builder with triggers, actions, AI nodes,
            real-time monitoring, and reliable error handling.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 font-semibold rounded-xl bg-indigo-600 text-white px-6 py-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 font-semibold rounded-xl border border-slate-300 dark:border-gray-700 px-6 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">4 Trigger Types</h2>
          <p className="text-muted-foreground">Start your workflows any way you need</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {triggers.map((t) => (
            <div
              key={t.name}
              className="group rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                <t.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="bg-slate-50/80 dark:bg-gray-900/40 border-y border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">6+ Action Types</h2>
            <p className="text-muted-foreground">Connect any service into a single pipeline</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {actions.map((a) => (
              <div
                key={a.name}
                className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-5 text-center hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center mx-auto mb-3">
                  <a.icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{a.name}</h3>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Platform Features</h2>
          <p className="text-muted-foreground">Everything you need for production automation</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex gap-4 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-6 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="bg-slate-50/80 dark:bg-gray-900/40 border-y border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Tech Stack</h2>
          <p className="text-muted-foreground mb-8">Modern tools for a reliable solution</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'Next.js 15',
              'NestJS',
              'TypeScript',
              'PostgreSQL',
              'Redis',
              'BullMQ',
              'Prisma',
              'React Flow',
              'Tailwind CSS',
              'Docker',
              'Swagger',
            ].map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-sm font-medium"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to automate?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Build your first workflow in minutes — visually, quickly, and without code.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 font-semibold rounded-xl bg-indigo-600 text-white px-8 py-3.5 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 text-lg"
        >
          Start Now
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">FlowForge</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FlowForge — Workflow Automation Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
