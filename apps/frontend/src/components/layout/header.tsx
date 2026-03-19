'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { NotificationDropdown } from './notification-dropdown';
import { ChevronRight, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  workflows: 'Workflows',
  executions: 'Executions',
  integrations: 'Connections',
  credentials: 'Credentials',
  templates: 'Templates',
  settings: 'Settings',
  editor: 'Editor',
  new: 'New',
};

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm">
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const label = ROUTE_LABELS[seg] || (seg.length > 20 ? seg.slice(0, 8) + '…' : seg);
        const isLast = i === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
          {user?.name || 'User'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-card shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <Settings className="h-3.5 w-3.5" /> Settings
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors w-full text-left"
          >
            <Sun className="h-3.5 w-3.5 dark:hidden" />
            <Moon className="h-3.5 w-3.5 hidden dark:block" />
            Toggle Theme
          </button>
          <div className="border-t my-1" />
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4 bg-card/50 backdrop-blur-sm shrink-0">
      <Breadcrumbs />
      <div className="flex items-center gap-2">
        <NotificationDropdown />
        <UserMenu />
      </div>
    </header>
  );
}
