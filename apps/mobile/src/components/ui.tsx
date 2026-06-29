import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? theme.colors.gold : theme.colors.cream;
  const fg = variant === 'primary' ? theme.colors.white : theme.colors.bronze;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.gold} />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function OfflineBanner() {
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>
        ✈️ Offline — using downloaded content. Changes will sync.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  heading: { fontSize: 22, fontWeight: '700', color: theme.colors.ink },
  muted: { fontSize: 14, color: theme.colors.muted },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  offline: { backgroundColor: theme.colors.cream, padding: 8 },
  offlineText: { color: theme.colors.bronze, fontSize: 12, textAlign: 'center' },
});
