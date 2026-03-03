import { useState, useRef, useEffect, useCallback } from 'react';
import { getNotifications, markNotificationRead, markAllRead } from '../api/notifications.js';
import { formatDate } from '../utils/helpers.js';

export default function Topbar({ title, onMenuToggle, userId, user }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const ref = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getNotifications(userId);
      setNotifs(result || []);
    } catch { /* ignore notification fetch errors */ }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.isRead).length;
  const initials = user ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() : 'U';
  const isEmployee = user && user.role !== 'applicant';
  const avatarCls = isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-600';

  const typeIcon = (type) => {
    const map = { admission: '📋', exam: '📝', scoring: '🧮', status: '🔔', info: '📋', success: '✅', warning: '⚠️' };
    return map[type] || '🔔';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 lg:px-6 h-16 flex items-center justify-between" role="banner">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-xl" aria-label="Toggle navigation menu">☰</button>
        <h1 className="text-lg font-bold text-forest-500">{title}</h1>
      </div>
      <div className="flex items-center gap-3" ref={ref}>
        {/* Notification Bell */}
        <button
          onClick={() => { setShowNotifs(!showNotifs); refresh(); }}
          className="relative p-2 rounded-lg hover:bg-gray-100"
          data-testid="notification-bell"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          aria-expanded={showNotifs}
          aria-haspopup="true"
        >
          🔔
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showNotifs && (
          <div className="absolute top-14 right-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50" role="menu" aria-label="Notifications">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm text-forest-500">Notifications</span>
              <button
                onClick={async () => { await markAllRead(userId); refresh(); }}
                className="text-xs text-[#166534] hover:text-[#14532d] font-medium"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">No notifications</div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${!n.isRead ? 'Unread: ' : ''}${n.title || ''} ${n.message}`}
                    onClick={async () => { await markNotificationRead(n.id); refresh(); }}
                    onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await markNotificationRead(n.id); refresh(); } }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-gold-50/50' : ''}`}
                  >
                    <span className="text-lg shrink-0">{typeIcon(n.type)}</span>
                    <div className="min-w-0">
                      {n.title && <p className={`text-xs font-bold ${!n.isRead ? 'text-forest-600' : 'text-gray-500'}`}>{n.title}</p>}
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-forest-500' : 'text-gray-600'}`}>{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full ${avatarCls} flex items-center justify-center text-xs font-bold`}>
          {initials}
        </div>
      </div>
    </header>
  );
}
