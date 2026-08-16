'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface DocRow {
  id: string;
  filename: string;
  status: string;
  type?: string;
}

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-cream text-bronze',
  ocr: 'bg-cream text-bronze',
  cleaned: 'bg-cream text-bronze',
  classified: 'bg-cream text-gold-deep',
  embedded: 'bg-gold/20 text-gold-deep',
  failed: 'bg-error/15 text-error',
};

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('curriculum');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const authHeaders = useCallback(
    (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/documents`, { headers: authHeaders() });
      if (res.ok) setDocs(await res.json());
    } catch {
      /* ignore network errors in the admin tool */
    }
  }, [token, authHeaders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !token) {
      setMessage('Paste an access token and choose a file first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      const res = await fetch(`${API_URL}/api/admin/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      setMessage(
        res.ok ? `Ingested "${data.filename}" → ${data.status}` : `Error: ${JSON.stringify(data)}`,
      );
      await refresh();
    } catch (err) {
      setMessage(`Upload failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-paper px-6 py-12">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-flame font-heading font-bold text-white">
          Y
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Yenetta · Content Pipeline</h1>
          <p className="font-body text-sm text-muted">
            Upload curriculum/exam documents and watch them ingest.
          </p>
        </div>
      </header>

      <section className="mb-6 rounded-2xl bg-cream p-5">
        <label className="mb-2 block font-body text-sm font-medium text-ink">Access token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste a JWT access token (from /auth/otp/verify)"
          className="w-full rounded-lg border border-gold/30 bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-gold"
        />
      </section>

      <form onSubmit={onUpload} className="mb-8 space-y-4 rounded-2xl border border-gold/20 p-5">
        <div>
          <label className="mb-2 block font-body text-sm font-medium text-ink">
            Document (PDF, TXT, MD)
          </label>
          <input
            type="file"
            accept=".pdf,.txt,.md,text/plain,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full font-body text-sm text-muted"
          />
        </div>
        <div>
          <label className="mb-2 block font-body text-sm font-medium text-ink">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-gold/30 bg-paper px-3 py-2 font-body text-sm text-ink"
          >
            <option value="curriculum">Curriculum</option>
            <option value="exam_question">Exam question</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-gold px-5 py-2 font-body text-sm font-semibold text-white transition hover:bg-gold-deep disabled:opacity-50"
        >
          {busy ? 'Ingesting…' : 'Upload & ingest'}
        </button>
        {message && <p className="font-body text-sm text-gold-deep">{message}</p>}
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-ink">Documents</h2>
          <button onClick={() => void refresh()} className="font-body text-sm text-gold underline">
            Refresh
          </button>
        </div>
        <ul className="space-y-2">
          {docs.length === 0 && <li className="font-body text-sm text-muted">No documents yet.</li>}
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-gold/15 px-4 py-3"
            >
              <span className="font-body text-sm text-ink">{d.filename}</span>
              <span
                className={`rounded-full px-3 py-1 font-body text-xs ${STATUS_COLORS[d.status] ?? 'bg-cream text-muted'}`}
              >
                {d.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
