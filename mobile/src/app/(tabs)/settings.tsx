import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Header, PressableScale, Screen } from '@/components/ui';
import { accents, colors, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';

const ACCENT = accents.settings;

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'Signed in'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </Card>

        <Card style={{ paddingVertical: space.sm }}>
          <PressableScale style={styles.row} onPress={() => Linking.openURL(API_URL)}>
            <Feather name="globe" size={18} color={ACCENT} />
            <Text style={styles.rowText}>Open the website</Text>
            <Feather name="external-link" size={16} color={colors.textMuted} />
          </PressableScale>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Feather name="server" size={18} color={ACCENT} />
            <Text style={styles.rowText}>Server</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{API_URL.replace(/^https?:\/\//, '')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Feather name="info" size={18} color={ACCENT} />
            <Text style={styles.rowText}>Version</Text>
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </Card>

        <Button title="Sign out" icon="log-out" color={ACCENT} variant="secondary" onPress={confirmSignOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, gap: space.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: `${accents.today}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#a5b4fc', fontSize: 22, fontWeight: '600' },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  email: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { color: colors.text, fontSize: 15, flex: 1 },
  rowValue: { color: colors.textMuted, fontSize: 14, maxWidth: '55%' },
  divider: { height: 1, backgroundColor: colors.border },
});
