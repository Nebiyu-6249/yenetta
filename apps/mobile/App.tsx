import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Loading } from './src/components/ui';
import { ChapterScreen } from './src/screens/ChapterScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { ProfileScreen } from './src/screens/PaywallScreen';
import { StudyScreen, type OpenChapter } from './src/screens/StudyScreen';
import { AuthProvider, useAuth } from './src/state/auth';
import { OfflineDataProvider } from './src/state/offline-data';
import { theme } from './src/theme';

type TabKey = 'tutor' | 'study' | 'practice' | 'profile';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'tutor', label: 'Tutor', icon: '' },
  { key: 'study', label: 'Study', icon: '' },
  { key: 'practice', label: 'Practice', icon: '' },
  { key: 'profile', label: 'Profile', icon: '' },
];

function Tabs() {
  const [tab, setTab] = useState<TabKey>('tutor');
  const [chapter, setChapter] = useState<OpenChapter | null>(null);

  if (chapter) {
    return <ChapterScreen chapter={chapter} onBack={() => setChapter(null)} />;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        {tab === 'tutor' && <ChatScreen />}
        {tab === 'study' && <StudyScreen onOpen={setChapter} />}
        {tab === 'practice' && <PracticeScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Loading…" />;
  return user ? <Tabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineDataProvider>
        <SafeAreaView style={styles.safe}>
          <Root />
          <StatusBar style="dark" />
        </SafeAreaView>
      </OfflineDataProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.paper },
  flex: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    paddingVertical: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 11, color: theme.colors.muted },
  tabActive: { color: theme.colors.gold, fontWeight: '700' },
});
