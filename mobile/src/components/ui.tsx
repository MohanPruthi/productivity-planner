import { Feather } from '@expo/vector-icons';
import { ComponentRef, ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, onAccent, radius, space } from '@/constants/theme';

type FeatherName = keyof typeof Feather.glyphMap;

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, icon, color, right }: { title: string; icon?: FeatherName; color?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon ? <Feather name={icon} size={16} color={color ?? colors.textSecondary} /> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function PressableScale({ style, children, ...props }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [style, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}>
      {children as ReactNode}
    </Pressable>
  );
}

export function Checkbox({ checked, color, onPress, size = 24, disabled }: { checked: boolean; color: string; onPress?: () => void; size?: number; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [
        styles.checkbox,
        {
          width: size,
          height: size,
          borderRadius: size / 3.4,
          borderColor: checked ? color : colors.borderStrong,
          backgroundColor: checked ? color : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {checked ? <Feather name="check" size={size * 0.65} color={onAccent(color)} /> : null}
    </Pressable>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  color: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: FeatherName;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, color, variant = 'primary', loading, disabled, icon, style }: ButtonProps) {
  const primary = variant === 'primary';
  const fg = primary ? onAccent(color) : colors.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        primary
          ? { backgroundColor: color }
          : { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, color = colors.textSecondary, label }: { icon: FeatherName; onPress?: () => void; color?: string; label: string }) {
  return (
    <PressableScale onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.iconButton}>
      <Feather name={icon} size={18} color={color} />
    </PressableScale>
  );
}

export type InputRef = ComponentRef<typeof TextInput>;

export function Input({ style, ref, ...props }: TextInputProps & { ref?: Ref<InputRef> }) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.textSecondary}
      keyboardAppearance="dark"
      {...props}
      style={[styles.input, style]}
    />
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function LoadingView({ color }: { color: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color} size="large" />
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error}>
      <Feather name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorRetry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.md,
  },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  headerSubtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  checkbox: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.2)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: { color: colors.text, flex: 1, fontSize: 14 },
  errorRetry: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: space.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600' },
});
