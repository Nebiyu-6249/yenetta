import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CachedChapter } from '../lib/offline/types';
import { api, type Chapter } from '../lib/api';
import { useOffline } from '../state/offline-data';
import { theme } from '../theme';
import { Button, Card, Heading, Loading, Muted, OfflineBanner } from '../components/ui';

export interface OpenChapter {
  id: string;
  subjectId: string;
  title: string;
}

export function StudyScreen({ onOpen }: { onOpen: (c: OpenChapter) => void }) {
  const { online, download, store, ready } = useOffline();
  const [downloaded, setDownloaded] = useState<CachedChapter[]>([]);
  const [online_chapters, setOnlineChapters] = useState<Chapter[] | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refreshDownloaded = useCallback(async () => {
    setDownloaded(await store.listChapters());
  }, [store]);

  useEffect(() => {
    if (ready) void refreshDownloaded();
  }, [ready, refreshDownloaded]);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const subjects = await api.subjects();
      const all = await Promise.all(subjects.map((s) => api.chapters(s.id)));
      setOnlineChapters(all.flat());
    })();
  }, [online]);

  const downloadChapter = async (ch: Chapter) => {
    setDownloading(ch.id);
    try {
      await download.downloadChapter(ch.id, ch.subjectId, ch.title);
      await refreshDownloaded();
    } finally {
      setDownloading(null);
    }
  };

  const isDownloaded = (id: string) => downloaded.some((d) => d.id === id);

  if (!ready) return <Loading label="Opening library…" />;

  return (
    <View style={styles.container}>
      {!online && <OfflineBanner />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View>
          <Heading>Study</Heading>
          <Muted>Download chapters to study offline.</Muted>
        </View>

        {downloaded.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.section}>Downloaded</Text>
            {downloaded.map((c) => (
              <Card key={c.id}>
                <Text style={styles.title}>{c.title}</Text>
                <View style={styles.row}>
                  <Muted>Available offline</Muted>
                  <Button
                    label="Open"
                    onPress={() => onOpen({ id: c.id, subjectId: c.subjectId, title: c.title })}
                    variant="secondary"
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {online && (
          <View style={{ gap: 8 }}>
            <Text style={styles.section}>All chapters</Text>
            {online_chapters === null ? (
              <Loading label="Loading…" />
            ) : (
              online_chapters
                .filter((c) => !isDownloaded(c.id))
                .map((c) => (
                  <Card key={c.id}>
                    <Text style={styles.title}>{c.title}</Text>
                    <View style={styles.row}>
                      <Muted>Unit {c.unitNo}</Muted>
                      <Button
                        label={downloading === c.id ? 'Downloading…' : 'Download'}
                        onPress={() => downloadChapter(c)}
                        disabled={downloading === c.id}
                      />
                    </View>
                  </Card>
                ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.paper },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  title: { fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
});
