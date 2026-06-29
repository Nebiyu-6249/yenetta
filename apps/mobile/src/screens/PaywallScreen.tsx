import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { Button, Card, Heading, Muted, OfflineBanner } from '../components/ui';
import { useOffline } from '../state/offline-data';

const PREMIUM_FEATURES = [
  'Unlimited AI conversations',
  'Full ESSLCE/EUEE entrance-exam prep',
  'Unlimited mock exams',
  'Personalized study plans',
  'Advanced progress analytics',
];

export function ProfileScreen() {
  const { user, entitlement, logout } = useAuth();
  const { online, lastSync } = useOffline();
  const premium = entitlement?.tier === 'premium';

  return (
    <View style={styles.container}>
      {!online && <OfflineBanner />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Heading>Profile</Heading>
        <Card>
          <Text style={styles.name}>{user?.name ?? user?.phone ?? 'Student'}</Text>
          <Muted>
            {premium ? 'Premium plan' : 'Free plan'}
            {lastSync ? ` · last synced ${new Date(lastSync).toLocaleTimeString()}` : ''}
          </Muted>
        </Card>

        {!premium && (
          <Card style={{ borderColor: theme.colors.gold }}>
            <Text style={styles.upgrade}>Upgrade to Premium</Text>
            <Muted>ETB 299 / month · Telebirr, CBE Birr, or card</Muted>
            <View style={{ marginTop: 12, gap: 6 }}>
              {PREMIUM_FEATURES.map((f) => (
                <Text key={f} style={styles.feature}>
                  ✓ {f}
                </Text>
              ))}
            </View>
            <View style={{ marginTop: 14 }}>
              <Button label="Upgrade (Chapa — coming in M6)" onPress={() => undefined} disabled />
            </View>
          </Card>
        )}

        <Button label="Log out" variant="secondary" onPress={() => void logout()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.paper },
  name: { fontSize: 17, fontWeight: '700', color: theme.colors.ink },
  upgrade: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  feature: { fontSize: 14, color: theme.colors.ink },
});
