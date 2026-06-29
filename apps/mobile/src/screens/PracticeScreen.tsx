import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GradedResult } from '@yenetta/shared';
import type { CachedQuestion } from '../lib/offline/types';
import { useOffline } from '../state/offline-data';
import { theme } from '../theme';
import { Button, Card, Heading, Loading, Muted, OfflineBanner } from '../components/ui';

const PRACTICE_YEAR = 2015;

export function PracticeScreen() {
  const { online, download, practice, store, ready } = useOffline();
  const [questions, setQuestions] = useState<CachedQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadCached = useCallback(async () => {
    setQuestions(await store.getQuestions({ year: PRACTICE_YEAR }));
  }, [store]);

  useEffect(() => {
    if (ready) void loadCached();
  }, [ready, loadCached]);

  const downloadPractice = async () => {
    setDownloading(true);
    try {
      await download.downloadPractice(PRACTICE_YEAR);
      await loadCached();
    } finally {
      setDownloading(false);
    }
  };

  const submit = async () => {
    if (!questions) return;
    const { graded } = await practice.submit(
      questions,
      questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
    );
    setResult(graded);
  };

  if (!ready) return <Loading />;

  return (
    <View style={styles.container}>
      {!online && <OfflineBanner />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View>
          <Heading>Exam Practice</Heading>
          <Muted>Past papers — graded on-device, works offline.</Muted>
        </View>

        {!questions || questions.length === 0 ? (
          <Card>
            <Muted>Download the {PRACTICE_YEAR} paper to practice (offline-ready).</Muted>
            <View style={{ marginTop: 12 }}>
              <Button
                label={downloading ? 'Downloading…' : `Download ${PRACTICE_YEAR} paper`}
                onPress={downloadPractice}
                disabled={downloading || !online}
              />
            </View>
            {!online && <Muted>Connect once to download; then it works offline.</Muted>}
          </Card>
        ) : (
          <>
            {result && (
              <Card style={{ borderColor: theme.colors.gold }}>
                <Text style={styles.score}>
                  Score: {result.correct}/{result.total} ({Math.round(result.scoreFraction * 100)}%)
                </Text>
                <Muted>Saved offline — will sync when you reconnect.</Muted>
              </Card>
            )}
            {questions.map((q, i) => {
              const r = result?.results.find((x) => x.questionId === q.id);
              return (
                <Card key={q.id}>
                  <Text style={styles.stem}>
                    {i + 1}. {q.stem}
                  </Text>
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt;
                    const correct = r && opt === r.correctAnswer;
                    const wrong = r && selected && !r.correct;
                    return (
                      <Pressable
                        key={opt}
                        disabled={!!result}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        style={[
                          styles.option,
                          selected && styles.selected,
                          correct && styles.correct,
                          wrong && styles.wrong,
                        ]}
                      >
                        <Text style={styles.optionText}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                  {r?.explanation ? <Muted>{r.explanation}</Muted> : null}
                </Card>
              );
            })}
            {!result && <Button label="Submit practice" onPress={submit} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.paper },
  score: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  stem: { fontSize: 15, fontWeight: '600', color: theme.colors.ink, marginBottom: 8 },
  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 8,
  },
  selected: { borderColor: theme.colors.gold, backgroundColor: theme.colors.cream },
  correct: { borderColor: theme.colors.success, backgroundColor: 'rgba(46,125,50,0.1)' },
  wrong: { borderColor: theme.colors.error, backgroundColor: 'rgba(192,57,43,0.1)' },
  optionText: { color: theme.colors.ink },
});
