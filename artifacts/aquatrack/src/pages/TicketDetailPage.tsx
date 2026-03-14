import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketApi } from '@/services/api';
import type { TicketDetail } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending_close: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  escalated: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  pending_close: 'Pending Close',
  escalated: 'Escalated',
  closed: 'Closed',
  archived: 'Archived',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await ticketApi.get(token, id);
      setTicket(data);
    } catch {
      setError('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !message.trim()) return;
    setSending(true);
    try {
      await ticketApi.sendMessage(token, id, message.trim());
      setMessage('');
      load();
    } catch {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const action = async (fn: () => Promise<unknown>) => {
    try { await fn(); load(); } catch { setError('Action failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>;
  if (!ticket) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Ticket not found</div>;

  const canMessage = !['closed', 'archived'].includes(ticket.status);
  const isOwner = ticket.user_id === user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tickets')} className="text-muted-foreground hover:text-foreground transition text-sm">← Back</button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-foreground">{ticket.subject}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">#{ticket.id} · From: {ticket.user_email}</p>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      {(user?.role === 'admin' || user?.role === 'owner') && (
        <div className="px-6 py-2 border-b border-border bg-muted/30 flex gap-2 flex-wrap">
          {ticket.status === 'open' && (
            <button onClick={() => action(() => ticketApi.proposeClose(token!, id!))}
              className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition">
              Propose Closure
            </button>
          )}
          {(ticket.status === 'open' || ticket.status === 'pending_close') && (
            <button onClick={() => action(() => ticketApi.escalate(token!, id!))}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition">
              Escalate to Owner
            </button>
          )}
          {user?.role === 'owner' && ticket.status === 'closed' && (
            <button onClick={() => action(() => ticketApi.archive(token!, id!))}
              className="px-3 py-1.5 text-xs rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition">
              Archive
            </button>
          )}
          {user?.role === 'owner' && (
            <button onClick={() => action(async () => { await ticketApi.delete(token!, id!); navigate('/tickets'); })}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition ml-auto">
              Delete Ticket
            </button>
          )}
        </div>
      )}

      {/* Pending close banner for ticket owner */}
      {ticket.status === 'pending_close' && isOwner && (
        <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-900">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-2">
            An admin has proposed closing this ticket. Do you agree?
          </p>
          <div className="flex gap-2">
            <button onClick={() => action(() => ticketApi.approveClose(token!, id!))}
              className="px-3 py-1.5 text-xs rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition">
              Approve Closure
            </button>
            <button onClick={() => action(() => ticketApi.rejectClose(token!, id!))}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted font-medium transition">
              Keep Open
            </button>
          </div>
        </div>
      )}

      {error && <p className="mx-6 mt-3 text-sm text-red-500">{error}</p>}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {/* Original description */}
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xs font-bold shrink-0">
            {ticket.user_email[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-foreground">{ticket.user_email}</span>
              <span className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
            </div>
          </div>
        </div>

        {ticket.messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.sender_role === 'owner' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300' :
                msg.sender_role === 'admin' ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {msg.sender_email[0].toUpperCase()}
              </div>
              <div className={`flex-1 ${isMine ? 'items-end' : ''} flex flex-col`}>
                <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-foreground">{msg.sender_email}</span>
                  <span className="text-xs text-muted-foreground capitalize">{msg.sender_role}</span>
                  <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div className={`rounded-xl px-4 py-2.5 max-w-xl ${
                  isMine
                    ? 'bg-blue-500 text-white'
                    : 'bg-card border border-border text-foreground'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      {canMessage && (
        <form onSubmit={sendMessage} className="px-6 py-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium transition"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
