import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/services/api';
import type { UserRecord } from '@/types';

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  user: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  banned: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function ControlPanelPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await userApi.list(token);
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await userApi.setStatus(token, id, status);
      load();
    } catch {
      setError('Failed to update status');
    } finally {
      setBusy(null);
    }
  };

  const updateRole = async (id: number, role: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await userApi.setRole(token, id, role);
      load();
    } catch {
      setError('Failed to update role');
    } finally {
      setBusy(null);
    }
  };

  if (user?.role !== 'owner') {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access denied</div>;
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Control Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage all user accounts</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                    {u.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{u.email}</span>
                      {u.id === user.id && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role]}`}>
                        {u.role}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[u.status]}`}>
                        {u.status}
                      </span>
                    </div>
                  </div>
                </div>

                {u.id !== user.id && u.role !== 'owner' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Role controls */}
                    {u.role === 'user' && (
                      <button
                        disabled={busy === u.id}
                        onClick={() => updateRole(u.id, 'admin')}
                        className="px-3 py-1.5 text-xs rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-medium transition disabled:opacity-50"
                      >
                        Promote to Admin
                      </button>
                    )}
                    {u.role === 'admin' && (
                      <button
                        disabled={busy === u.id}
                        onClick={() => updateRole(u.id, 'user')}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition disabled:opacity-50"
                      >
                        Demote to User
                      </button>
                    )}

                    {/* Status controls */}
                    {u.status === 'active' && (
                      <>
                        <button
                          disabled={busy === u.id}
                          onClick={() => updateStatus(u.id, 'suspended')}
                          className="px-3 py-1.5 text-xs rounded-lg border border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 font-medium transition disabled:opacity-50"
                        >
                          Suspend
                        </button>
                        <button
                          disabled={busy === u.id}
                          onClick={() => updateStatus(u.id, 'banned')}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition disabled:opacity-50"
                        >
                          Ban
                        </button>
                      </>
                    )}
                    {u.status !== 'active' && (
                      <button
                        disabled={busy === u.id}
                        onClick={() => updateStatus(u.id, 'active')}
                        className="px-3 py-1.5 text-xs rounded-lg border border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 font-medium transition disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Joined {new Date(u.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
