import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorBanner, Input, InputRef, Screen } from '@/components/ui';
import { accents, colors, radius, space } from '@/constants/theme';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';

const WAKE_HINT_AFTER_MS = 4000;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<InputRef>(null);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (wakeTimer.current) clearTimeout(wakeTimer.current);
  }, []);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setError('');
    setSubmitting(true);
    // A sleeping free server answers slowly; explain the wait instead of looking stuck
    wakeTimer.current = setTimeout(() => setWakingUp(true), WAKE_HINT_AFTER_MS);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
      setWakingUp(false);
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <View style={styles.logoRow}>
              <View style={[styles.tile, { backgroundColor: '#fff' }]} />
              <View style={[styles.tile, { backgroundColor: '#a5b4fc' }]} />
            </View>
            <View style={styles.logoRow}>
              <View style={[styles.tile, { backgroundColor: '#a5b4fc' }]} />
              <View style={[styles.tile, { backgroundColor: '#fff' }]} />
            </View>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your planner</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!submitting}
            />
            <Text style={[styles.label, { marginTop: space.lg }]}>Password</Text>
            <Input
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!submitting}
            />

            {error ? <View style={{ marginTop: space.lg }}><ErrorBanner message={error} /></View> : null}

            <Button title="Sign in" color={accents.today} onPress={submit} loading={submitting} style={{ marginTop: space.xl }} />

            {wakingUp ? (
              <View style={styles.wake}>
                <Text style={styles.wakeTitle}>Waking up the server…</Text>
                <Text style={styles.wakeText}>
                  The server sleeps when it hasn&apos;t been used for a while. The first sign-in can take up to a minute.
                </Text>
              </View>
            ) : null}

            <Text style={styles.hint}>Forgot your password? Reset it on the website, then sign in here.</Text>
            {__DEV__ ? <Text style={styles.server}>{API_URL}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: accents.today,
    alignSelf: 'center',
    padding: 13,
    gap: 4,
    marginBottom: space.xl,
  },
  logoRow: { flex: 1, flexDirection: 'row', gap: 4 },
  tile: { flex: 1, borderRadius: 4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '600', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: space.xs },
  form: { marginTop: space.xl },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: space.sm },
  wake: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  wakeTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  wakeText: { color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: space.xl, lineHeight: 18 },
  server: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: space.sm },
});
