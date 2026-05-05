import React, { useEffect, useState } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getRoleNotificationDefaults,
  updateRoleNotificationDefaults,
  NotificationPreference,
  NotificationRolePreference,
} from '../../api/notificationPreferences';
import { ActionButton } from '../../components/UI';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const EVENTS = [
  { key: 'schedule_closed', label: 'Exam schedule closed' },
  { key: 'admission_status', label: 'Admission status changes' },
  { key: 'exam_submitted', label: 'Exam submitted' },
];

const ROLES = [
  { key: 'administrator', label: 'Administrator' },
  { key: 'registrar', label: 'Registrar' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'applicant', label: 'Applicant' },
];

export default function NotificationPreferences() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';
  const [prefs, setPrefs] = useState<Record<string, NotificationPreference | null>>({});
  const [roleDefaults, setRoleDefaults] = useState<Record<string, Record<string, NotificationRolePreference | null>>>({});
  const [loading, setLoading] = useState(false);
  const [savingRoleDefaults, setSavingRoleDefaults] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [res, roleRes] = await Promise.all([
          getNotificationPreferences(),
          getRoleNotificationDefaults(),
        ]);
        const map: Record<string, NotificationPreference | null> = {};
        (res || []).forEach((p: any) => { map[p.eventType] = p; });
        const roleMap: Record<string, Record<string, NotificationRolePreference | null>> = {};
        ROLES.forEach(r => {
          roleMap[r.key] = {};
          EVENTS.forEach(e => { roleMap[r.key][e.key] = null; });
        });
        (roleRes || []).forEach((r: any) => {
          if (!roleMap[r.role]) roleMap[r.role] = {};
          roleMap[r.role][r.eventType] = r;
        });

        if (mounted) {
          setPrefs(map);
          setRoleDefaults(roleMap);
        }
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const toggle = (key: string) => {
    const cur = prefs[key];
    const next = { ...prefs, [key]: cur ? { ...cur, enabled: !cur.enabled } : { id: 0, userId: 0, eventType: key, enabled: true, createdAt: new Date().toISOString() } };
    setPrefs(next);
  };

  const save = async () => {
    const payload = EVENTS.map(e => ({ eventType: e.key, enabled: !!prefs[e.key]?.enabled }));
    setLoading(true);
    try {
      await updateNotificationPreferences(payload);
      showToast('Notification preferences saved.', 'success');
    } catch {
      showToast('Failed to save notification preferences.', 'error');
    } finally { setLoading(false); }
  };

  const toggleRoleDefault = (role: string, key: string) => {
    setRoleDefaults(prev => {
      const current = prev[role]?.[key];
      const nextForRole = {
        ...(prev[role] || {}),
        [key]: current
          ? { ...current, enabled: !current.enabled }
          : {
              id: 0,
              role,
              eventType: key,
              enabled: true,
              createdAt: new Date().toISOString(),
            },
      };
      return { ...prev, [role]: nextForRole };
    });
  };

  const saveRoleDefaults = async () => {
    const payload = ROLES.flatMap(r =>
      EVENTS.map(e => ({
        role: r.key,
        eventType: e.key,
        enabled: !!roleDefaults[r.key]?.[e.key]?.enabled,
      }))
    );

    setSavingRoleDefaults(true);
    try {
      await updateRoleNotificationDefaults(payload);
      showToast('Role notification defaults saved.', 'success');
    } catch {
      showToast('Failed to save role notification defaults.', 'error');
    } finally {
      setSavingRoleDefaults(false);
    }
  };

  return (
    <div className="gk-section-card p-6">
      <h3 className="text-lg font-semibold mb-3">Notification Preferences</h3>
      <div className="flex flex-col gap-3">
        {EVENTS.map(e => (
          <div key={e.key} className="flex items-center justify-between gap-4">
            <div>
              <div>{e.label}</div>
              {roleDefaults[user?.role || '']?.[e.key] && (
                <div className="text-xs text-gray-500 mt-0.5">
                  Role default: {roleDefaults[user?.role || '']?.[e.key]?.enabled ? 'Enabled' : 'Disabled'}
                </div>
              )}
            </div>
            <div>
              <label className="inline-flex items-center">
                <input type="checkbox" checked={!!prefs[e.key]?.enabled} onChange={() => toggle(e.key)} />
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <ActionButton onClick={save} disabled={loading}>Save preferences</ActionButton>
      </div>

      {isAdmin && (
        <div className="mt-8 border-t border-gray-200 pt-5">
          <h4 className="text-base font-semibold mb-3">Role Default Templates</h4>
          <p className="text-xs text-gray-500 mb-4">Set baseline notification behavior per role. Users can still personalize their own toggles.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-gray-200">Event</th>
                  {ROLES.map(role => (
                    <th key={role.key} className="text-center px-3 py-2 border-b border-gray-200">{role.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENTS.map(event => (
                  <tr key={event.key} className="border-b border-gray-100">
                    <td className="px-3 py-2">{event.label}</td>
                    {ROLES.map(role => (
                      <td key={`${role.key}_${event.key}`} className="text-center px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!roleDefaults[role.key]?.[event.key]?.enabled}
                          onChange={() => toggleRoleDefault(role.key, event.key)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <ActionButton onClick={saveRoleDefaults} disabled={savingRoleDefaults || loading}>
              {savingRoleDefaults ? 'Saving role defaults...' : 'Save role defaults'}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
