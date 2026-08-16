'use client';

import { useRef, useState } from 'react';
import { api, ApiError, type CitedSource } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { Button } from '../../../components/ui';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: CitedSource[];
  grounded?: boolean;
}

const SUGGESTIONS = [
  'Explain photosynthesis in plant cells',
  'What is the pH scale?',
  'Help me revise acids and bases',
];

export default function ChatPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await api.chat(message, undefined, conversationId, locale);
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.answer, sources: res.sources, grounded: res.grounded },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "You've reached today's free AI limit. Upgrade to Premium for more."
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-flame font-heading font-bold text-white">
            Y
          </div>
          <h1 className="font-heading text-2xl font-bold text-ink">{t('askTutor')}</h1>
          <p className="mt-2 max-w-md font-body text-sm text-muted">
            Answers are grounded in your curriculum and past papers, with sources.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="rounded-full border border-gold/20 bg-white px-4 py-2 font-body text-sm text-ink hover:border-gold"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 font-body text-sm ${
                  m.role === 'user'
                    ? 'bg-gold text-white'
                    : 'border border-gold/15 bg-white text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                  <div className="mt-3 border-t border-gold/10 pt-2">
                    <p className="mb-1 font-body text-xs font-semibold text-muted">Sources</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-bronze"
                        >
                          {s.chapterTitle ?? s.type}
                          {s.year ? ` · ${s.year}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {m.role === 'assistant' && m.grounded === false && (
                  <p className="mt-2 font-body text-xs italic text-muted">
                    Not found in the curriculum
                  </p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-gold/15 bg-white px-4 py-3 font-body text-sm text-muted">
                Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="mb-2 font-body text-sm text-error">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 rounded-2xl border border-gold/20 bg-white p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your tutor…"
          className="flex-1 bg-transparent px-3 py-2 font-body text-sm outline-none"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
