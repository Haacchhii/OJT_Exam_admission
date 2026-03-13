import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllRead, createNotification } from '../api/notifications';
import { getUsers } from '../api/users';
import { formatDate } from '../utils/helpers';
import { SCHOOL_NAME } from '../utils/constants';
import { showToast } from './Toast';
import Modal from './Modal';
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
  const [showCompose, setShowCompose] = useState(false);
  const [composeUsers, setComposeUsers] = useState<User[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeMsg, setComposeMsg] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isStaff = user.role !== 'applicant';

  const openCompose = useCallback(async () => {
    setShowCompose(true);
    try {
      const result = await getUsers();
      const arr = Array.isArray(result) ? result : (result as any)?.data ?? [];
      setComposeUsers(arr);
    } catch { /* ignore */ }
  }, []);

  const handleSend = useCallback(async () => {
    if (!composeTo || !composeTitle.trim() || !composeMsg.trim()) return;
    setComposeSending(true);
    try {
      await createNotification({ userId: Number(composeTo), title: composeTitle.trim(), message: composeMsg.trim(), type: 'info' });
      showToast('Notification sent', 'success');
      setShowCompose(false);
      setComposeTo(''); setComposeTitle(''); setComposeMsg('');
    } catch { showToast('Failed to send', 'error'); }
    finally { setComposeSending(false); }
  }, [composeTo, composeTitle, composeMsg]);

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

  const unread = notifs.filter(n => !n.isRead).length;

  // Update browser tab title with unread count
  useEffect(() => {
    const baseTitle = `${SCHOOL_NAME} — Admission & Exam System`;
    document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
    return () => { document.title = baseTitle; };
  }, [unread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const isEmployee = user.role !== 'applicant';
  const avatarCls = isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-700';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  const typeIcon = (type?: string): string => {
    const map: Record<string, string> = { admission: 'admissions', exam: 'exam', scoring: 'results', status: 'bell', info: 'info', success: 'checkCircle', warning: 'exclamation' };
    return map[type || ''] || 'bell';
  };

  const notifLink = (type?: string): string | null => {
    const base = isEmployee ? '/employee' : '/student';
    const map: Record<string, string> = {
      admission: `${base}/${isEmployee ? 'admissions' : 'admission'}`,
      exam: `${base}/exam${isEmployee ? 's' : ''}`,
      scoring: `${base}/results`,
      status: `${base}/${isEmployee ? 'admissions' : 'admission'}`,
    };
    return map[type || ''] || null;
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 lg:px-8 h-[60px] flex items-center justify-between" role="banner">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-xl hover:bg-forest-50 transition-colors" aria-label="Toggle navigation menu">
          <Icon name="menu" className="w-5 h-5 text-forest-600" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3" ref={ref}>
        {isStaff && (
          <button
            onClick={openCompose}
            className="p-2.5 rounded-xl hover:bg-forest-50 transition-all duration-200 group"
            aria-label="Send notification"
            title="Send Notification"
          >
            <Icon name="mail" className="w-5 h-5 text-gray-500 group-hover:text-forest-600 transition-colors" />
          </button>
        )}
        <button
          onClick={() => { setShowNotifs(!showNotifs); refresh(); }}
          className="relative p-2.5 rounded-xl hover:bg-forest-50 transition-all duration-200 group"
          data-testid="notification-bell"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          aria-expanded={showNotifs}
          aria-haspopup="true"
        >
          <Icon name={unread > 0 ? 'bellAlert' : 'bell'} className="w-5 h-5 text-gray-500 group-hover:text-forest-600 transition-colors" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-bell-pulse" />
          )}
        </button>

        {showNotifs && (
          <div className="absolute top-14 right-4 w-80 bg-white rounded-xl shadow-elevated border border-gray-200 overflow-hidden z-50 animate-[scaleIn_0.15s_ease-out]" role="region" aria-label="Notifications">
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
                    onClick={async () => { await markNotificationRead(n.id); refresh(); const link = notifLink(n.type); if (link) { setShowNotifs(false); navigate(link); } }}
                    onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await markNotificationRead(n.id); refresh(); const link = notifLink(n.type); if (link) { setShowNotifs(false); navigate(link); } } }}
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

        <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />

        <div className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-all duration-200 group pl-1" onClick={() => navigate(isEmployee ? '/employee/profile' : '/student/profile')} title="View Profile">
          <div className={`w-9 h-9 rounded-lg ${avatarCls} flex items-center justify-center text-xs font-bold`}>
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{fullName || 'User'}</p>
            <p className="text-[11px] text-forest-500 leading-tight capitalize font-medium">{user.role === 'applicant' ? 'Student' : user.role || ''}</p>
          </div>
          <Icon name="chevronDown" className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
        </div>
      </div>

      {/* Send Notification Modal */}
      <Modal open={showCompose} onClose={() => setShowCompose(false)} title="Send Notification">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Recipient</label>
            <select value={composeTo} onChange={e => setComposeTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="">— Select user —</option>
              {composeUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
            <input value={composeTitle} onChange={e => setComposeTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" placeholder="Notification title" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Message</label>
            <textarea value={composeMsg} onChange={e => setComposeMsg(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm resize-none" placeholder="Type your message…" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSend} disabled={composeSending || !composeTo || !composeTitle.trim() || !composeMsg.trim()} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
              {composeSending ? 'Sending…' : 'Send'}
            </button>
            <button onClick={() => setShowCompose(false)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
