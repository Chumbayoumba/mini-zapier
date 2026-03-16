'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useDeleteNotification, type Notification } from '@/hooks/use-notifications';
import { useWebSocket } from '@/hooks/use-websocket';
import { useQueryClient } from '@tanstack/react-query';

function timeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  execution_failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  execution_completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  workflow_activated: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  workflow_deactivated: { icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
};

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = typeConfig[notification.type] || { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' };
  const Icon = cfg.icon;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0 ${
        !notification.isRead ? 'bg-indigo-500/5' : ''
      }`}
    >
      <div className={`flex-shrink-0 p-1.5 rounded-lg ${cfg.bg} mt-0.5`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notification.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.message}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>

      <div className="flex-shrink-0 flex items-center gap-0.5">
        {!notification.isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Mark as read"
          >
            <Check className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notificationsData } = useNotifications(1, 30);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  // WebSocket real-time updates
  const { on, connected } = useWebSocket();

  useEffect(() => {
    if (!connected) return;
    const unsub = on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => { unsub?.(); };
  }, [connected, on, queryClient]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  const handleMarkRead = useCallback((id: string) => {
    markAsRead.mutate(id);
  }, [markAsRead]);

  const handleDelete = useCallback((id: string) => {
    deleteNotification.mutate(id);
  }, [deleteNotification]);

  const notifications = notificationsData?.items || [];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white ring-2 ring-card">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border bg-card shadow-xl shadow-black/20 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs opacity-60 mt-0.5">You&apos;re all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 bg-card">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Showing {notifications.length} of {notificationsData?.total || 0} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
