import React, { useEffect, useState } from 'react';
import { getAdmissionComments, addAdmissionComment, deleteAdmissionComment } from '../api/admissionComments';
import { useAuth } from '../context/AuthContext';
import { ActionButton } from './UI';
import Icon from './Icons';
import { formatManilaDateTime } from '../utils/timezone';

export default function CommentsThread({ admissionId }: { admissionId: number }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getAdmissionComments(admissionId);
      setComments(res || []);
    } catch (err) {
      // ignore
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch();
    // subscribe to socket events
    let socket: any;
    try {
      // socket is provided by SocketContext via window.__GK_SOCKET__ or similar
      socket = (window as any).__GK_SOCKET__;
      if (socket && socket.on) {
        socket.on(`admission_comment_${admissionId}`, (c: any) => {
          setComments(prev => [...prev, c]);
        });
      }
    } catch (_) {}
    return () => {
      try { if (socket && socket.off) socket.off(`admission_comment_${admissionId}`); } catch (_) {}
    };
  }, [admissionId]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      const created = await addAdmissionComment(admissionId, newContent.trim());
      setComments(prev => [...prev, created]);
      setNewContent('');
    } catch (err) {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAdmissionComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (_) {}
  };

  return (
    <div className="gk-section-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800">Registrar Comments</h4>
        <span className="text-xs text-gray-500">Private notes for staff</span>
      </div>
      <div className="space-y-3 max-h-56 overflow-auto mb-3">
        {loading ? (
          <p className="text-sm text-gray-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500">No comments yet.</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="border rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">{c.user ? `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim() : 'Staff'}</div>
                  <div className="text-xs text-gray-400">{formatManilaDateTime(c.createdAt)}</div>
                </div>
                {(user && (user.id === c.userId || ['administrator','registrar'].includes(user.role))) && (
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 text-xs">Delete</button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-2">
        <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Add a private comment for staff..." className="w-full border rounded-lg p-2 text-sm" rows={3} />
        <div className="mt-2 flex justify-end">
          <ActionButton onClick={handleAdd} icon={<Icon name="send" className="w-4 h-4" />} size="sm">Add Comment</ActionButton>
        </div>
      </div>
    </div>
  );
}
