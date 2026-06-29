import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../lib/api';
import { useOffline } from '../state/offline-data';
import { theme } from '../theme';
import { Button, Card, Heading, Muted, OfflineBanner } from '../components/ui';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  sources?: { chapterTitle: string | null; year: number | null }[];
}

export function ChatScreen() {
  const { online } = useOffline();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await api.chat(message, conversationId);
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, sources: res.sources }]);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? 'Daily AI limit reached.'
          : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {!online && <OfflineBanner />}
      <View style={styles.header}>
        <Heading>Tutor</Heading>
        <Muted>Grounded answers from your curriculum</Muted>
      </View>
      <ScrollView style={styles.messages} contentContainerStyle={{ gap: 10, padding: 16 }}>
        {messages.length === 0 && (
          <Muted>Ask anything — e.g. &ldquo;Explain photosynthesis&rdquo;.</Muted>
        )}
        {messages.map((m, i) => (
          <Card key={i} style={m.role === 'user' ? styles.user : undefined}>
            <Text style={m.role === 'user' ? styles.userText : styles.text}>{m.text}</Text>
            {m.sources && m.sources.length > 0 && (
              <Text style={styles.sources}>
                Sources: {m.sources.map((s) => s.chapterTitle ?? 'curriculum').join(', ')}
              </Text>
            )}
          </Card>
        ))}
        {busy && <Muted>Thinking…</Muted>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!online && (
          <Muted>Live tutoring needs a connection. Downloaded study works offline.</Muted>
        )}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message your tutor…"
          editable={online}
          style={styles.input}
        />
        <Button label="Send" onPress={send} disabled={busy || !online || !input.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.paper },
  header: { padding: 16, paddingBottom: 0 },
  messages: { flex: 1 },
  user: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  userText: { color: theme.colors.white },
  text: { color: theme.colors.ink },
  sources: { marginTop: 8, fontSize: 11, color: theme.colors.muted },
  error: { color: theme.colors.error },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.white,
  },
});
