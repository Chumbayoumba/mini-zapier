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
} from 'lucide-react';

const triggers = [
  { icon: Globe, name: 'Webhook', desc: 'Мгновенный запуск по HTTP-запросу' },
  { icon: Clock, name: 'Расписание (Cron)', desc: 'Автозапуск по расписанию' },
  { icon: Mail, name: 'Email', desc: 'Триггер при получении письма' },
];

const actions = [
  { icon: Globe, name: 'HTTP-запрос', desc: 'Вызов любого REST API' },
  { icon: Mail, name: 'Email', desc: 'Отправка email-уведомлений' },
  { icon: Send, name: 'Telegram', desc: 'Сообщения в Telegram-бот' },
  { icon: Database, name: 'База данных', desc: 'Чтение и запись в БД' },
  { icon: Shuffle, name: 'Трансформация', desc: 'Преобразование данных между шагами' },
];

const features = [
  {
    icon: Workflow,
    title: 'Визуальный редактор',
    desc: 'Drag & drop построение workflow — без единой строки кода',
  },
  {
    icon: BarChart3,
    title: 'Мониторинг и логи',
    desc: 'Детальные логи каждого шага и статистика выполнений',
  },
  {
    icon: Shield,
    title: 'Обработка ошибок',
    desc: 'Retry, уведомления и пауза при сбоях — автоматически',
  },
  {
    icon: Layers,
    title: 'Очередь задач',
    desc: 'Bull + Redis для надёжной обработки тысяч workflow',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Mini-Zapier</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Начать бесплатно
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-violet-400/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-6">
            <Play className="h-3 w-3" />
            Платформа автоматизации рабочих процессов
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Автоматизируйте всё.{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Без кода.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Визуальный конструктор workflow с 3 типами триггеров, 5 типами действий,
            мониторингом в реальном времени и надёжной обработкой ошибок.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 font-semibold rounded-xl bg-indigo-600 text-white px-6 py-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
              Создать аккаунт
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 font-semibold rounded-xl border border-slate-300 dark:border-gray-700 px-6 py-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
            >
              Войти в систему
            </Link>
          </div>
        </div>
      </section>

      {/* ── Triggers ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">3 типа триггеров</h2>
          <p className="text-muted-foreground">Запускайте workflow любым удобным способом</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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

      {/* ── Actions ── */}
      <section className="bg-slate-50/80 dark:bg-gray-900/40 border-y border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">5 типов действий</h2>
            <p className="text-muted-foreground">Подключайте любые сервисы в единую цепочку</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Возможности платформы</h2>
          <p className="text-muted-foreground">Всё, что нужно для продакшн-автоматизации</p>
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

      {/* ── Tech Stack ── */}
      <section className="bg-slate-50/80 dark:bg-gray-900/40 border-y border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Технологический стек</h2>
          <p className="text-muted-foreground mb-8">Современные инструменты для надёжного решения</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'Next.js 15',
              'NestJS',
              'TypeScript',
              'PostgreSQL',
              'Redis',
              'Bull MQ',
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

      {/* ── CTA ── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Готовы автоматизировать?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Создайте свой первый workflow за пару минут — визуально, быстро и без кода.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 font-semibold rounded-xl bg-indigo-600 text-white px-8 py-3.5 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 text-lg"
        >
          Начать сейчас
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">Mini-Zapier</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Mini-Zapier — Платформа автоматизации workflow
          </p>
        </div>
      </footer>
    </div>
  );
}
