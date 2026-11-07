import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Checkbox, ErrorBanner, Header, LoadingView, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { accents, colors, radius, space } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { addDays, startOfDay, toLocalDateStr } from '@/lib/dates';
import { tap } from '@/lib/haptics';

const ACCENT = accents.meds;
const PARTIAL = '#f59e0b';

type Schedule = { medName: string; startDate: string; durationDays: number };
type MedLog = { id?: string; date: string; morning: boolean; evening: boolean };
type DayStatus = 'completed' | 'partial' | 'missed' | 'future';

export default function MedsScreen() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [sched, logData] = await Promise.all([api<Schedule>('/api/meds/schedule'), api<MedLog[]>('/api/meds/logs')]);
      setSchedule(sched);
      setLogs(logData);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = startOfDay(new Date());
  const todayStr = toLocalDateStr(today);
  const logByDate = new Map(logs.map((l) => [toLocalDateStr(new Date(l.date)), l]));
  const todayLog = logByDate.get(todayStr);

  const toggle = async (type: 'morning' | 'evening') => {
    tap();
    const current = Boolean(todayLog?.[type]);
    const optimistic: MedLog = { morning: false, evening: false, ...todayLog, date: todayLog?.date ?? today.toString(), [type]: !current };
    const replace = (log: MedLog) =>
      setLogs((prev) => {
        const others = prev.filter((l) => toLocalDateStr(new Date(l.date)) !== todayStr);
        return [...others, log];
      });
    const previous = logs;
    replace(optimistic);
    try {
      const saved = await api<MedLog>('/api/meds/log', { method: 'POST', body: { date: todayStr, [type]: !current } });
      replace(saved);
    } catch (err) {
      setLogs(previous);
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  let content = null;
  if (schedule) {
    const total = schedule.durationDays || 60;
    const start = startOfDay(new Date(schedule.startDate));
    const dayNum = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;

    const days = Array.from({ length: total }, (_, i) => {
      const d = addDays(start, i);
      const log = logByDate.get(toLocalDateStr(d));
      const morning = Boolean(log?.morning);
      const evening = Boolean(log?.evening);
      let status: DayStatus = 'future';
      if (d <= today) status = morning && evening ? 'completed' : morning || evening ? 'partial' : 'missed';
      // Today is not missed yet
      if (toLocalDateStr(d) === todayStr && status === 'missed') status = 'future';
      return { dayNum: i + 1, status, isToday: toLocalDateStr(d) === todayStr };
    });
    const perfect = days.filter((d) => d.status === 'completed').length;
    const partial = days.filter((d) => d.status === 'partial').length;
    const missed = days.filter((d) => d.status === 'missed').length;
    const inCourse = dayNum >= 1 && dayNum <= total;

    content = (
      <>
        <Card>
          <SectionTitle title="Today" icon="sun" color={ACCENT} />
          <View style={styles.toggleRow}>
            {(['morning', 'evening'] as const).map((type) => {
              const checked = Boolean(todayLog?.[type]);
              return (
                <Pressable
                  key={type}
                  onPress={() => toggle(type)}
                  style={({ pressed }) => [
                    styles.toggle,
                    checked && { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}14` },
                    pressed && { opacity: 0.75 },
                  ]}>
                  <Checkbox checked={checked} color={ACCENT} onPress={() => toggle(type)} size={26} />
                  <View>
                    <Text style={styles.toggleTitle}>{type === 'morning' ? 'Morning' : 'Evening'}</Text>
                    <Text style={styles.toggleSub}>{checked ? 'Taken' : 'Not yet'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Course progress" icon="activity" color={ACCENT} />
          <Text style={styles.dayText}>
            {inCourse ? `Day ${dayNum} of ${total}` : dayNum > total ? `Course complete (${total} days)` : `Starts in ${1 - dayNum} day${1 - dayNum === 1 ? '' : 's'}`}
          </Text>
          <View style={{ marginTop: space.md }}>
            <ProgressBar value={Math.min(Math.max(dayNum, 0), total) / total} color={ACCENT} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Perfect days" value={perfect} color={colors.success} />
            <Stat label="Partial" value={partial} color={PARTIAL} />
            <Stat label="Missed" value={missed} color={colors.textSecondary} />
          </View>
          <Text style={styles.completion}>{Math.round((perfect / total) * 100)}% of the course taken in full</Text>

          <View style={styles.grid}>
            {days.map((d) => (
              <View
                key={d.dayNum}
                style={[
                  styles.cell,
                  d.status === 'completed' && { backgroundColor: colors.success },
                  d.status === 'partial' && { backgroundColor: PARTIAL },
                  d.status === 'missed' && { backgroundColor: 'rgba(255,45,85,0.35)' },
                  d.isToday && { borderColor: colors.text, borderWidth: 1.5 },
                ]}
              />
            ))}
          </View>
        </Card>
      </>
    );
  }

  return (
    <Screen>
      <Header title="Meds" subtitle={schedule?.medName} />
      {loading ? (
        <LoadingView color={ACCENT} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={ACCENT} />}>
          {error ? <ErrorBanner message={error} onRetry={() => load(true)} /> : null}
          {content}
        </ScrollView>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xl * 2 },
  toggleRow: { flexDirection: 'row', gap: space.md },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  toggleTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  toggleSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dayText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginTop: space.lg, gap: space.md },
  stat: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '600' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  completion: { color: colors.textMuted, fontSize: 13, marginTop: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.lg },
  cell: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
});
