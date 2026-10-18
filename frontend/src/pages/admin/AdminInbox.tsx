/**
 * Inbox: master list and reading pane. Opening a message marks it read.
 *
 * Below `md` there is no room for two panes, so the list is the screen and a tap raises the
 * message as a full-screen panel with a back button.
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import * as contactRepository from '../../repositories/contactRepository.ts';
import { apiErrorMessage } from '../../repositories/apiError.ts';
import type { ContactSubmission } from '../../types/index.ts';
import { useAdminChrome, usePrimaryAction } from './chrome.tsx';
import { ConsolePanel, MonoButton, MutedLine, formatWhen } from './ui.tsx';

type ReadFilter = 'all' | 'unread' | 'read';

const PAGE_SIZE = 50;

function MessageList({
  messages,
  selectedId,
  onOpen,
}: {
  messages: ContactSubmission[];
  selectedId: number | null;
  onOpen: (message: ContactSubmission) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="px-5 py-6">
        <MutedLine>No messages match this filter.</MutedLine>
      </div>
    );
  }
  return (
    <>
      {messages.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m)}
          className="w-full flex flex-col gap-1.5 px-4 sm:px-[18px] py-4 border-0 border-b border-ln text-left text-ink cursor-pointer"
          style={{ background: m.id === selectedId ? 'var(--s1)' : 'transparent' }}
        >
          <span className="flex justify-between gap-2 font-mono text-[12px] leading-none font-medium">
            <span className="truncate">
              {m.read ? '○' : '●'} {m.name}
            </span>
            <span className="text-mut whitespace-nowrap">{formatWhen(m.submittedAt)}</span>
          </span>
          <span
            className="text-[14px] leading-[1.4] text-ink2 overflow-hidden"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          >
            {m.message}
          </span>
        </button>
      ))}
    </>
  );
}

function MessageDetail({
  message,
  onBack,
  onArchive,
  onMarkUnread,
  busy,
}: {
  message: ContactSubmission;
  onBack: () => void;
  onArchive: () => void;
  onMarkUnread: () => void;
  busy: boolean;
}) {
  return (
    <div className="p-5 sm:p-7 flex flex-col gap-4 min-h-full">
      <button
        type="button"
        onClick={onBack}
        className="md:hidden self-start bg-transparent border-0 p-0 font-mono text-[12px] leading-none text-mut cursor-pointer"
      >
        ← Inbox
      </button>
      <span className="font-mono text-[11px] leading-[1.5] tracking-[0.1em] text-mut break-all">
        FROM {message.email} · {formatWhen(message.submittedAt)}
      </span>
      <span className="font-display font-extrabold text-[26px] sm:text-[34px] leading-none tracking-[-0.02em] [font-stretch:115%] break-words">
        {message.name}
      </span>
      <p className="m-0 text-[17px] leading-[1.6] max-w-[62ch] whitespace-pre-line">{message.message}</p>
      <div className="flex gap-2 flex-wrap mt-auto pt-4">
        <a
          href={`mailto:${message.email}?subject=${encodeURIComponent('Re: your message on tom-sabala.dev')}`}
          className="bg-acc text-onacc no-underline font-mono text-[12px] leading-none font-medium uppercase tracking-[0.06em] px-3.5 py-3"
        >
          Reply by email
        </a>
        <MonoButton onClick={onMarkUnread} disabled={busy}>
          Mark unread
        </MonoButton>
        <MonoButton tone="muted" onClick={onArchive} disabled={busy}>
          Archive
        </MonoButton>
      </div>
    </div>
  );
}

export default function AdminInbox(): JSX.Element {
  const { notify, refreshStats } = useAdminChrome();
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<ReadFilter>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await contactRepository.getSubmissions(PAGE_SIZE, page * PAGE_SIZE, filter, includeArchived);
      if (!res.success) {
        setLoadError(res.error || 'Could not load messages');
        return;
      }
      const list = (res.data.submissions ?? []) as ContactSubmission[];
      setMessages(list);
      setTotal(res.data.total ?? list.length);
      setLoadError(null);
      setSelected(prev => (prev ? list.find(m => m.id === prev.id) ?? null : null));
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load messages'));
    }
  };

  useEffect(() => {
    load();
  }, [page, filter, includeArchived]);

  const markAllRead = async () => {
    setBusy(true);
    try {
      const res = await contactRepository.markAllRead();
      if (!res.success) {
        notify('err', res.error || 'Could not mark everything read');
        return;
      }
      notify('ok', `${res.data?.updated ?? 0} messages marked read`);
      await load();
      refreshStats();
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not mark everything read'));
    } finally {
      setBusy(false);
    }
  };

  usePrimaryAction({ label: 'Mark all read', onClick: markAllRead, disabled: busy }, [busy, page, filter, includeArchived]);

  const open = async (message: ContactSubmission) => {
    setSelected(message);
    if (message.read) return;
    try {
      await contactRepository.setReadStatus(message.id, true);
      setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, read: true } : m)));
      setSelected(prev => (prev && prev.id === message.id ? { ...prev, read: true } : prev));
      refreshStats();
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not mark the message read'));
    }
  };

  const markUnread = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await contactRepository.setReadStatus(selected.id, false);
      setMessages(prev => prev.map(m => (m.id === selected.id ? { ...m, read: false } : m)));
      setSelected(prev => (prev ? { ...prev, read: false } : prev));
      refreshStats();
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not mark the message unread'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!selected) return;
    if (!confirm('Archive this message? It stays available under “archived”.')) return;
    setBusy(true);
    try {
      const res = await contactRepository.archiveSubmission(selected.id);
      if (!res.success) {
        notify('err', res.error || 'Could not archive the message');
        return;
      }
      notify('ok', 'Message archived');
      setSelected(null);
      await load();
      refreshStats();
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not archive the message'));
    } finally {
      setBusy(false);
    }
  };

  const filters: Array<{ key: ReadFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        {filters.map(f => (
          <MonoButton
            key={f.key}
            tone={filter === f.key ? 'accent' : 'muted'}
            onClick={() => {
              setFilter(f.key);
              setPage(0);
            }}
          >
            {f.label}
          </MonoButton>
        ))}
        <MonoButton
          tone={includeArchived ? 'accent' : 'muted'}
          onClick={() => {
            setIncludeArchived(v => !v);
            setPage(0);
          }}
        >
          Archived
        </MonoButton>
        <span className="font-mono text-[11px] leading-none text-mut ml-auto">{total} total</span>
      </div>

      {loadError && <MutedLine>{loadError}</MutedLine>}

      <ConsolePanel className="min-h-[520px] md:grid" style={{ gridTemplateColumns: 'minmax(260px, 380px) minmax(0, 1fr)' }}>
        <div className="md:border-r md:border-ln min-w-0">
          <MessageList messages={messages} selectedId={selected?.id ?? null} onOpen={open} />
        </div>
        <div className="hidden md:block min-w-0">
          {selected ? (
            <MessageDetail
              message={selected}
              busy={busy}
              onBack={() => setSelected(null)}
              onArchive={archive}
              onMarkUnread={markUnread}
            />
          ) : (
            <div className="p-7">
              <MutedLine>Select a message to read it.</MutedLine>
            </div>
          )}
        </div>
      </ConsolePanel>

      {total > PAGE_SIZE && (
        <div className="flex gap-2 items-center">
          <MonoButton tone="muted" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ← Newer
          </MonoButton>
          <MonoButton
            tone="muted"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= total}
          >
            Older →
          </MonoButton>
          <span className="font-mono text-[11px] leading-none text-mut">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
        </div>
      )}

      {selected && (
        <div className="md:hidden fixed inset-0 z-40 bg-bg overflow-y-auto">
          <MessageDetail
            message={selected}
            busy={busy}
            onBack={() => setSelected(null)}
            onArchive={archive}
            onMarkUnread={markUnread}
          />
        </div>
      )}
    </div>
  );
}
