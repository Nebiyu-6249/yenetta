import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { Button, Heading, Muted } from '../components/ui';

export function LoginScreen() {
  const { login } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestOtp(phone);
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429 ? 'Too many requests.' : 'Invalid phone number.',
      );
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(await api.verifyOtp(phone, code));
    } catch {
      setError('Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.flame}>
        <Text style={styles.flameEmoji}>Y</Text>
      </View>
      <Heading>Yenetta</Heading>
      <Muted>AI study companion for Ethiopian students</Muted>

      <View style={styles.form}>
        {step === 'phone' ? (
          <>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+251 9XX XXX XXX"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <Button label={busy ? 'Sending…' : 'Send code'} onPress={sendCode} disabled={busy} />
          </>
        ) : (
          <>
            {devCode ? <Muted>Dev code: {devCode}</Muted> : null}
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              style={[styles.input, styles.code]}
            />
            <Button
              label={busy ? 'Verifying…' : 'Verify & continue'}
              onPress={verify}
              disabled={busy}
            />
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  flame: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  flameEmoji: { fontSize: 30 },
  form: { width: '100%', maxWidth: 340, marginTop: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: theme.colors.white,
  },
  code: { textAlign: 'center', letterSpacing: 8, fontSize: 20 },
  error: { color: theme.colors.error, fontSize: 14 },
});
