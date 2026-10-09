"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { markChatRead, sendMessage } from "@/lib/actions/chat";
import type { ChatContact, ChatMessage, UnreadSummary } from "@/lib/chat-types";
import { ROLE_LABELS } from "@/lib/permissions";
import { Avatar } from "../Avatar";

const POLL_OPEN_MS = 3000;
const POLL_CLOSED_MS = 20000;
const GROUP = "group";

/**
 * Chat de la campaña: canal general y conversaciones privadas con cada miembro.
 * Usa polling contra /api/campaigns/[id]/chat (funciona en Vercel sin WebSockets);
 * para tiempo real se puede cambiar por Supabase Realtime, Pusher o Ably.
 */
export function ChatPanel({
  campaignId,
  campaignName,
  currentUserId,
  contacts,
  initialUnread,
}: {
  campaignId: string;
  campaignName: string;
  currentUserId: string;
  contacts: ChatContact[];
  initialUnread: UnreadSummary;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string>(GROUP);
  /** En móvil se ve la lista o la conversación, no ambas. */
  const [mobileView, setMobileView] = useState<"list" | "conversation">("conversation");
  const [byChannel, setByChannel] = useState<Record<string, ChatMessage[]>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState<UnreadSummary>(initialUnread);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Último id recibido por canal (cursor del polling). */
  const lastIds = useRef<Record<string, number>>({});
  /** Último id notificado como leído por canal. */
  const reported = useRef<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const merge = useCallback((ch: string, incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    lastIds.current[ch] = Math.max(lastIds.current[ch] ?? 0, ...incoming.map((m) => m.id));
    setByChannel((prev) => {
      const current = prev[ch] ?? [];
      const seen = new Set(current.map((m) => m.id));
      return { ...prev, [ch]: [...current, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id) };
    });
  }, []);

  // Polling: con el panel abierto trae el canal actual; cerrado solo el resumen de no leídos.
  useEffect(() => {
    let cancelled = false;
    const target = open ? channel : "none";
    async function poll() {
      try {
        const after = target === "none" ? 0 : (lastIds.current[target] ?? 0);
        const res = await fetch(`/api/campaigns/${campaignId}/chat?channel=${target}&after=${after}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages: ChatMessage[]; unread: UnreadSummary };
        if (cancelled) return;
        if (target !== "none") {
          merge(target, data.messages);
          setLoaded((l) => (l[target] ? l : { ...l, [target]: true }));
        }
        setUnread(data.unread);
      } catch {
        // red caída: se reintenta en el siguiente ciclo
      }
    }
    void poll();
    const id = setInterval(() => {
      if (!document.hidden) void poll();
    }, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, channel, campaignId, merge]);

  const messages = byChannel[channel] ?? [];
  const newest = messages.at(-1)?.id ?? 0;

  // Con una conversación abierta, lo recibido cuenta como leído: se avisa al servidor.
  useEffect(() => {
    if (!open || newest <= (reported.current[channel] ?? 0)) return;
    reported.current[channel] = newest;
    void markChatRead(campaignId, channel, newest);
  }, [open, channel, newest, campaignId]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, channel, messages.length]);

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // La conversación abierta nunca cuenta como no leída (el servidor se entera en el siguiente ciclo).
  const unreadOf = (ch: string) => (open && ch === channel ? 0 : ch === GROUP ? unread.group : (unread.direct[ch] ?? 0));
  const totalUnread = unreadOf(GROUP) + contacts.reduce((sum, c) => sum + unreadOf(c.id), 0);
  const contact = contacts.find((c) => c.id === channel);

  function selectChannel(ch: string) {
    setChannel(ch);
    setMobileView("conversation");
    setError(null);
  }

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendMessage(campaignId, body, channel === GROUP ? null : channel);
      if ("error" in result) setError(result.error);
      else {
        setDraft("");
        merge(channel, [result.message]);
      }
    } catch {
      setError("No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary fixed right-5 bottom-5 z-40 rounded-full px-5 py-3 shadow-xl shadow-black/40"
        >
          💬 Chat
          {totalUnread > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 text-[11px] leading-5 font-bold text-white">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={close} />
          <section
            aria-label="Chat de la campaña"
            className="fixed top-0 right-0 z-50 flex h-dvh w-full border-l border-line bg-[#0f0c14]/95 shadow-2xl backdrop-blur-xl sm:w-[760px]"
          >
            {/* Conversaciones */}
            <aside
              className={`w-full shrink-0 flex-col border-r border-line sm:flex sm:w-60 ${mobileView === "list" ? "flex" : "hidden"}`}
            >
              <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-ink-4 uppercase">Chat</p>
                  <p className="truncate font-display font-bold text-ink">{campaignName}</p>
                </div>
                <button type="button" onClick={close} className="btn btn-ghost btn-sm sm:hidden" aria-label="Cerrar chat">
                  ✕
                </button>
              </header>
              <nav aria-label="Conversaciones" className="flex-1 overflow-y-auto p-2">
                <ChannelButton active={channel === GROUP} unread={unreadOf(GROUP)} onClick={() => selectChannel(GROUP)}>
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-base">#</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">General</span>
                    <span className="block text-[11px] text-ink-4">Toda la mesa</span>
                  </span>
                </ChannelButton>
                <p className="mt-3 mb-1 px-2 text-[10px] font-bold tracking-[0.14em] text-ink-4 uppercase">Privados</p>
                {contacts.length === 0 && <p className="px-2 text-xs text-ink-4">Aún no hay más miembros.</p>}
                {contacts.map((c) => (
                  <ChannelButton key={c.id} active={channel === c.id} unread={unreadOf(c.id)} onClick={() => selectChannel(c.id)}>
                    <Avatar name={c.displayName} src={c.avatarUrl} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{c.displayName}</span>
                      <span className="block truncate text-[11px] text-ink-4">
                        {c.role !== "player" ? ROLE_LABELS[c.role] : `@${c.username}`}
                      </span>
                    </span>
                  </ChannelButton>
                ))}
              </nav>
            </aside>

            {/* Conversación */}
            <div className={`min-w-0 flex-1 flex-col sm:flex ${mobileView === "conversation" ? "flex" : "hidden"}`}>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="btn btn-ghost btn-sm sm:hidden"
                  aria-label="Ver conversaciones"
                >
                  ←
                  {totalUnread > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
                </button>
                {contact ? (
                  <Link href={`/u/${contact.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-90">
                    <Avatar name={contact.displayName} src={contact.avatarUrl} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{contact.displayName}</span>
                      <span className="block text-[11px] text-emerald-300/90">🔒 Privado: solo vosotros dos podéis leerlo</span>
                    </span>
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink"># General</p>
                    <p className="text-[11px] text-ink-4">Lo leen todos los miembros de la campaña</p>
                  </div>
                )}
                <button type="button" onClick={close} className="btn btn-ghost btn-sm" aria-label="Cerrar chat">
                  ✕
                </button>
              </header>

              <div ref={listRef} className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
                {!loaded[channel] && <p className="m-auto text-sm text-ink-4">Cargando…</p>}
                {loaded[channel] && messages.length === 0 && (
                  <p className="m-auto max-w-60 text-center text-sm text-ink-4">
                    {contact ? `Escríbele a ${contact.displayName}: nadie más verá esta conversación.` : "Nadie ha escrito todavía. ¡Rompe el hielo!"}
                  </p>
                )}
                {messages.map((m, i) => (
                  <Bubble key={m.id} message={m} previous={messages[i - 1]} mine={m.userId === currentUserId} showAuthor={!contact} />
                ))}
              </div>

              <form
                className="border-t border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                    rows={2}
                    maxLength={2000}
                    aria-label={contact ? `Mensaje privado para ${contact.displayName}` : "Mensaje para toda la mesa"}
                    placeholder={contact ? `Mensaje privado para ${contact.displayName}…` : "Escribe a toda la mesa… (Enter envía)"}
                    className="input resize-none"
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                    {sending ? "…" : "Enviar"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ChannelButton({
  active,
  unread,
  onClick,
  children,
}: {
  active: boolean;
  unread: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
        active ? "bg-accent/15" : "hover:bg-card"
      }`}
    >
      {children}
      {unread > 0 && (
        <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] leading-5 font-bold text-white" aria-label={`${unread} sin leer`}>
          {unread}
        </span>
      )}
    </button>
  );
}

function Bubble({
  message: m,
  previous,
  mine,
  showAuthor,
}: {
  message: ChatMessage;
  previous?: ChatMessage;
  mine: boolean;
  showAuthor: boolean;
}) {
  const grouped =
    previous?.userId === m.userId && new Date(m.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;
  const name = m.displayName ?? "Usuario eliminado";
  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "" : "mt-3"}`}>
      {showAuthor && <div className="w-7 shrink-0">{!grouped && !mine && <Avatar name={name} src={m.avatarUrl} size={28} />}</div>}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showAuthor && !grouped && !mine && <span className="mb-0.5 text-xs font-semibold text-accent-2">{name}</span>}
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            mine ? "rounded-br-sm bg-accent text-on-accent" : "rounded-bl-sm border border-line bg-card text-ink"
          }`}
          title={new Date(m.createdAt).toLocaleString("es-ES")}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}
