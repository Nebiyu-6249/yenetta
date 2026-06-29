import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { APP_TAGLINE, APP_WORDMARK, colors } from '@yenetta/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.flame}>
        <Text style={styles.flameEmoji}>🔥</Text>
      </View>
      <Text style={styles.wordmark}>{APP_WORDMARK}</Text>
      <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      <Text style={styles.note}>Milestone 0 — mobile reads the shared brand theme.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  flame: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameEmoji: {
    fontSize: 32,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.ink,
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
  },
  note: {
    fontSize: 12,
    color: colors.bronze,
    textAlign: 'center',
  },
});
