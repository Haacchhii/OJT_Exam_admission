import React, { useEffect, useState } from 'react';
import { getNotificationPreferences, updateNotificationPreferences, NotificationPreference } from '../../api/notificationPreferences';
import { ActionButton } from '../../components/UI';

const EVENTS = [
  { key: 'schedule_closed', label: 'Exam schedule closed' },
  { key: 'admission_status', label: 'Admission status changes' },
  { key: 'exam_submitted', label: 'Exam submitted' },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Record<string, NotificationPreference | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getNotificationPreferences();
        const map: Record<string, NotificationPreference | null> = {};
        (res || []).forEach((p: any) => { map[p.eventType] = p; });
        if (mounted) setPrefs(map);
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
    } finally { setLoading(false); }
  };

  return (
    <div className="gk-section-card p-6">
      <h3 className="text-lg font-semibold mb-3">Notification Preferences</h3>
      <div className="flex flex-col gap-3">
        {EVENTS.map(e => (
          <div key={e.key} className="flex items-center justify-between">
            <div>{e.label}</div>
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
    </div>
  );
}
