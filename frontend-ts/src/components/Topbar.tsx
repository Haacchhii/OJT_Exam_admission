import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SCHOOL_NAME } from '../utils/constants';
import Icon from './Icons';
import type { User } from '../types';

interface TopbarProps {
  title: string;
  onMenuToggle: () => void;
  userId: number;
  user: User;
}

export default function Topbar({ title, onMenuToggle, userId, user }: TopbarProps) {
  const navigate = useNavigate();
  void userId;

  // Keep a stable app title.
  useEffect(() => {
    const titleValue = `${SCHOOL_NAME} — Admission & Exam System`;
    document.title = titleValue;
    return () => { document.title = titleValue; };
  }, []);
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const isEmployee = user.role !== 'applicant';
  const avatarCls = isEmployee ? 'bg-forest-500 text-gold-300' : 'bg-gold-400 text-forest-700';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

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
      <div className="flex items-center gap-3">

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

    </header>
  );
}
