'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Workflow,
  History,
  Settings,
  LogOut,
  Zap,
  ChevronRight,
  Plug,
  Key,
  PanelLeftClose,
  PanelLeftOpen,
  Blocks,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
  { href: '/templates', label: 'Templates', icon: Blocks },
  { href: '/executions', label: 'Executions', icon: History },
  { href: '/integrations', label: 'Connections', icon: Plug },
  { href: '/credentials', label: 'Credentials', icon: Key },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const { collapsed, toggle } = useSidebarStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col border-r bg-card shrink-0 transition-all duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-14 items-center border-b px-3', collapsed ? 'justify-center' : 'gap-2.5 px-4')}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-md shadow-indigo-500/25 shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && <span className="text-lg font-bold tracking-tight">FlowForge</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/50" />}
                  </>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return link;
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t p-2 space-y-0.5">
          {/* Collapse toggle */}
          <button
            onClick={toggle}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150',
              collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2 w-full',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="flex-1 text-left">Collapse</span>
              </>
            )}
          </button>

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Log out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
