import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { isPremiumOffline, readCachedEntitlement } from '../lib/entitlement-cache';
import { useAuth } from '../state/auth';
import { useOffline } from '../state/offline-data';
import { theme } from '../theme';
import { Button, Card, Heading, Muted, OfflineBanner } from '../components/ui';

const PREMIUM_FEATURES = [
  'Unlimited AI conversations',
  'Full ESSLCE/EUEE entrance-exam prep',
  'Unlimited mock exams',
  'Personalized study plans',
];

export function ProfileScreen() {
  const { user, entitlement, logout } = useAuth();
  const { online, lastSync } = useOffline();
  const [offlinePremium, setOfflinePremium] = useState(false);
  const [voucher, setVoucher] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readCachedEntitlement().then((c) => setOfflinePremium(isPremiumOffline(c)));
  }, []);

  // Online state wins; fall back to the cached signed token when offline.
  const premium = online ? entitlement?.tier === 'premium' : offlinePremium;

  const checkout = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { checkoutUrl } = await api.checkout();
      await Linking.openURL(checkoutUrl);
    } catch {
      setMessage('Could not start checkout.');
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.redeemVoucher(voucher);
      setMessage('🎉 Premium unlocked! Reopen the app to refresh.');
    } catch {
      setMessage('Invalid or expired voucher.');
    } finally {
      setBusy(false);
    }
  };

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
            <View style={{ marginTop: 10, gap: 6 }}>
              {PREMIUM_FEATURES.map((f) => (
                <Text key={f} style={styles.feature}>
                  ✓ {f}
                </Text>
              ))}
            </View>
            <View style={{ marginTop: 14, gap: 10 }}>
              <Button label={busy ? 'Starting…' : 'Pay with Chapa'} onPress={checkout} disabled={busy || !online} />
              <View style={styles.voucherRow}>
                <TextInput
                  value={voucher}
                  onChangeText={setVoucher}
                  placeholder="Voucher code"
                  style={styles.input}
                />
                <Button label="Redeem" variant="secondary" onPress={redeem} disabled={busy || !online || !voucher} />
              </View>
            </View>
            {message ? <Muted>{message}</Muted> : null}
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
  voucherRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.white },
});
