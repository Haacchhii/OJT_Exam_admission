import { useState, useRef, useEffect, useCallback } from 'react';
import { getNotifications, markNotificationRead, markAllRead } from '../api/notifications';
import { formatDate } from '../utils/helpers';
import Icon from './Icons';
import type { User, Notification } from '../types';

interface TopbarProps {
  title: string;
  onMenuToggle: () => void;
  userId: number;
  user: User;
}

export default function Topbar({ title, onMenuToggle, userId, user }: TopbarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getNotifications(String(userId));
      const arr = Array.isArray(result) ? result : (result as any)?.data ?? [];
      setNotifs(arr);
    } catch { /* ignore notification fetch errors */ }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.isRead).length;
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const isEmployee = user.role !== 'applicant';
  const avatarCls = isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-700';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  const typeIcon = (type?: string): string => {
    const map: Record<string, string> = { admission: 'admissions', exam: 'exam', scoring: 'results', status: 'bell', info: 'info', success: 'checkCircle', warning: 'exclamation' };
    return map[type || ''] || 'bell';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-gray-200/60 px-4 lg:px-6 h-16 flex items-center justify-between" role="banner">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Toggle navigation menu">
          <Icon name="menu" className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2" ref={ref}>
        <button
          onClick={() => { setShowNotifs(!showNotifs); refresh(); }}
          className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
          data-testid="notification-bell"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          aria-expanded={showNotifs}
          aria-haspopup="true"
        >
          <Icon name={unread > 0 ? 'bellAlert' : 'bell'} className="w-5 h-5 text-gray-500" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {showNotifs && (
          <div className="absolute top-14 right-4 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-elevated border border-gray-200/60 overflow-hidden z-50 animate-[scaleIn_0.15s_ease-out]" role="menu" aria-label="Notifications">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100/80">
              <span className="font-semibold text-sm text-gray-800">Notifications</span>
              <button
                onClick={async () => { await markAllRead(String(userId)); refresh(); }}
                className="text-xs text-forest-500 hover:text-forest-600 font-medium transition-colors"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Icon name="inbox" className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No notifications</p>
                </div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${!n.isRead ? 'Unread: ' : ''}${n.title || ''} ${n.message}`}
                    onClick={async () => { await markNotificationRead(n.id); refresh(); }}
                    onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await markNotificationRead(n.id); refresh(); } }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors ${!n.isRead ? 'bg-forest-50/30' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.isRead ? 'bg-forest-100 text-forest-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Icon name={typeIcon(n.type)} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {n.title && <p className={`text-xs font-semibold ${!n.isRead ? 'text-gray-800' : 'text-gray-500'}`}>{n.title}</p>}
                      <p className={`text-sm leading-snug ${!n.isRead ? 'font-medium text-gray-700' : 'text-gray-500'}`}>{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-forest-400 shrink-0 mt-1.5" />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl ${avatarCls} flex items-center justify-center text-xs font-bold shadow-sm`}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{fullName || 'User'}</p>
            <p className="text-[11px] text-gray-400 leading-tight capitalize">{user.role === 'applicant' ? 'Student' : user.role || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
