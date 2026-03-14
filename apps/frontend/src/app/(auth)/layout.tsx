import { Zap, Workflow, BarChart3, Globe, Shield, ArrowRight } from 'lucide-react';

const features = [
  { icon: Workflow, title: 'Visual Workflow Builder', desc: 'Drag & drop nodes to build automations in minutes' },
  { icon: Globe, title: 'Connect 5+ Services', desc: 'HTTP, Email, Telegram, Database, and more' },
  { icon: BarChart3, title: 'Real-time Monitoring', desc: 'Track every execution with detailed logs' },
  { icon: Shield, title: 'Reliable & Secure', desc: 'Built-in retries, error handling, and auth' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left — Feature panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-10 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-12">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">FlowForge</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold leading-tight mb-3">
            Automate your<br />workflows with ease
          </h1>
          <p className="text-indigo-200/80 text-sm leading-relaxed max-w-sm">
            Build powerful integrations between your favorite services — no coding required.
          </p>
        </div>

        <div className="relative z-10 space-y-5 my-8">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3.5 group">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 border border-white/10 shrink-0 group-hover:bg-white/15 transition-colors">
                <f.icon className="h-4 w-4 text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-indigo-300/70 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-indigo-400/50">
          © {new Date().getFullYear()} FlowForge. Built for modern teams.
        </p>
      </div>

      {/* Right — Auth form */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-gray-50 via-white to-indigo-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
