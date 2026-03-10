import { useState, useEffect, createContext, useContext } from 'react';
import Modal from './Modal.jsx';
import { ROLE_PERMISSIONS } from '../context/AuthContext.jsx';

/* ===== Keyboard Shortcuts Context ===== */
const ShortcutsContext = createContext(null);

const SHORTCUTS = [
  { keys: ['Alt', 'D'], label: 'Go to Dashboard', action: 'nav-dashboard' },
  { keys: ['Alt', 'A'], label: 'Go to Admissions', action: 'nav-admissions' },
  { keys: ['Alt', 'E'], label: 'Go to Exams', action: 'nav-exams' },
  { keys: ['Alt', 'R'], label: 'Go to Results', action: 'nav-results' },
  { keys: ['Alt', 'U'], label: 'Go to Users', action: 'nav-users' },
  { keys: ['Escape'], label: 'Close modal / dialog', action: 'close' },
  { keys: ['?'], label: 'Show keyboard shortcuts', action: 'help' },
];

export function KeyboardShortcutsProvider({ children, navigate, role }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const perms = ROLE_PERMISSIONS[role] || (role === 'applicant' ? ['admissions', 'exams', 'results'] : []);

  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      const base = role === 'applicant' ? '/student' : '/employee';

      if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); navigate(base); }
      else if (e.altKey && e.key.toLowerCase() === 'a' && perms.includes('admissions')) { e.preventDefault(); navigate(`${base}/${role === 'applicant' ? 'admission' : 'admissions'}`); }
      else if (e.altKey && e.key.toLowerCase() === 'e' && perms.includes('exams')) { e.preventDefault(); navigate(`${base}/${role === 'applicant' ? 'exam' : 'exams'}`); }
      else if (e.altKey && e.key.toLowerCase() === 'r' && perms.includes('results')) { e.preventDefault(); navigate(`${base}/results`); }
      else if (e.altKey && e.key.toLowerCase() === 'u' && perms.includes('users')) { e.preventDefault(); navigate(`${base}/users`); }
      else if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) { setHelpOpen(true); }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, role, perms]);

  return (
    <ShortcutsContext.Provider value={{ openHelp: () => setHelpOpen(true) }}>
      {children}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="max-w-md">
        <h3 className="text-lg font-bold text-forest-500 mb-4">⌨️ Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-700">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setHelpOpen(false)} className="mt-4 w-full bg-forest-500 text-white py-2 rounded-lg font-semibold hover:bg-forest-600 text-sm">Close</button>
      </Modal>
    </ShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  return useContext(ShortcutsContext);
}
