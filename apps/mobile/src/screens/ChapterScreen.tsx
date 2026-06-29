import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CachedChapter, CachedFlashcard } from '../lib/offline/types';
import type { DueReview } from '../lib/offline';
import { useOffline } from '../state/offline-data';
import { theme } from '../theme';
import { Button, Card, Loading, Muted, OfflineBanner } from '../components/ui';
import type { OpenChapter } from './StudyScreen';

type Tab = 'summary' | 'notes' | 'cards';

export function ChapterScreen({ chapter, onBack }: { chapter: OpenChapter; onBack: () => void }) {
  const { online, store, srs } = useOffline();
  const [data, setData] = useState<CachedChapter | null>(null);
  const [cards, setCards] = useState<CachedFlashcard[]>([]);
  const [tab, setTab] = useState<Tab>('summary');

  const load = useCallback(async () => {
    setData(await store.getChapter(chapter.id));
    setCards(await store.getFlashcards(chapter.id));
  }, [store, chapter.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <Loading label="Loading chapter…" />;

  return (
    <View style={styles.container}>
      {!online && <OfflineBanner />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Study</Text>
        </Pressable>
        <Text style={styles.title}>{data.title}</Text>

        <View style={styles.tabs}>
          {(['summary', 'notes', 'cards'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)}>
              <Text style={[styles.tab, tab === t && styles.tabActive]}>
                {t === 'cards' ? 'Flashcards' : t}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'summary' && (
          <Card>
            <Text style={styles.body}>{data.summary}</Text>
          </Card>
        )}
        {tab === 'notes' && (
          <Card>
            {data.notes.map((n, i) => (
              <Text key={i} style={styles.note}>
                • {n}
              </Text>
            ))}
          </Card>
        )}
        {tab === 'cards' && (
          <FlashcardReview chapterId={chapter.id} srs={srs} cardCount={cards.length} />
        )}
      </ScrollView>
    </View>
  );
}

function FlashcardReview({
  chapterId,
  srs,
  cardCount,
}: {
  chapterId: string;
  srs: ReturnType<typeof useOffline>['srs'];
  cardCount: number;
}) {
  const [due, setDue] = useState<DueReview[] | null>(null);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    const all = await srs.listDue();
    setDue(all.filter((d) => d.card.chapterId === chapterId));
    setRevealed(false);
  }, [srs, chapterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!due) return <Loading />;
  if (due.length === 0) {
    return (
      <Card>
        <Muted>No cards due right now. {cardCount} card(s) in this chapter.</Muted>
      </Card>
    );
  }

  const current = due[0]!;
  const grade = async (g: number) => {
    await srs.review(current.flashcard.id, g);
    await refresh();
  };

  return (
    <Card>
      <Muted>{due.length} due · works offline</Muted>
      <Pressable onPress={() => setRevealed((r) => !r)} style={styles.flashcard}>
        <Text style={styles.cardLabel}>{revealed ? 'Answer' : 'Question'}</Text>
        <Text style={styles.body}>
          {revealed ? current.flashcard.back : current.flashcard.front}
        </Text>
        <Muted>{revealed ? 'Tap to hide' : 'Tap to reveal'}</Muted>
      </Pressable>
      {revealed && (
        <View style={styles.grades}>
          <Button label="Again" variant="secondary" onPress={() => grade(1)} />
          <Button label="Good" variant="secondary" onPress={() => grade(4)} />
          <Button label="Easy" onPress={() => grade(5)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.paper },
  back: { color: theme.colors.gold, fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.ink },
  tabs: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  tab: { fontSize: 14, color: theme.colors.muted, textTransform: 'capitalize' },
  tabActive: { color: theme.colors.ink, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.ink },
  note: { fontSize: 14, color: theme.colors.ink, marginBottom: 6 },
  flashcard: { paddingVertical: 16, gap: 8 },
  cardLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  grades: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
});
