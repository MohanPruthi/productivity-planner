import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Checkbox,
  EmptyText,
  ErrorBanner,
  Header,
  IconButton,
  Input,
  LoadingView,
  Pill,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { accents, colors, difficultyColors, radius, space } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { addDays, formatDay, toLocalDateStr } from '@/lib/dates';
import { success, tap } from '@/lib/haptics';

const ACCENT = accents.today;

type PlanDay = { id: string; topic: string; dayLabel: string; isDone: boolean; track: string; planWeek?: { weekNumber: number } };
type NormalTask = { id: string; text: string; isDone: boolean };
type DsaLog = { id: string; questionNumber: string; title: string; difficulty: string };
type MedLog = { morning: boolean; evening: boolean };
type TodayData = {
  planDays: PlanDay[];
  dsaLogs: DsaLog[];
  normalTasks: NormalTask[];
  meds: { schedule: { medName: string } | null; todayLog: MedLog | null };
};

const DAY_OPTIONS = [
  { offset: -1, label: 'Yesterday' },
  { offset: 0, label: 'Today' },
  { offset: 1, label: 'Tomorrow' },
];

export default function TodayScreen() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<TodayData | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);

  const dateStr = toLocalDateStr(addDays(new Date(), offset));
  const requestId = useRef(0);

  const load = useCallback(async (date: string, mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [today, week] = await Promise.all([
        api<TodayData>(`/api/dashboard/today?date=${date}`),
        api<{ streak: number }>('/api/dashboard/week'),
      ]);
      if (id !== requestId.current) return;
      setData(today);
      setStreak(week.streak);
      setError('');
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Reload whenever the tab is focused or the day changes (other tabs may have changed data)
  const hasData = useRef(false);
  useEffect(() => {
    hasData.current = data !== null;
  }, [data]);
  useFocusEffect(
    useCallback(() => {
      load(dateStr, hasData.current ? 'silent' : 'initial');
    }, [load, dateStr])
  );

  const changeDay = (next: number) => {
    if (next === offset) return;
    tap();
    setData(null);
    setOffset(next);
  };

  const togglePlan = async (item: PlanDay) => {
    tap();
    const next = !item.isDone;
    setData((d) => d && { ...d, planDays: d.planDays.map((p) => (p.id === item.id ? { ...p, isDone: next } : p)) });
    try {
      await api(`/api/plan/days/${item.id}`, { method: 'PATCH', body: { isDone: next } });
      if (next) load(dateStr, 'silent');
    } catch (err) {
      setData((d) => d && { ...d, planDays: d.planDays.map((p) => (p.id === item.id ? { ...p, isDone: !next } : p)) });
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  const toggleTask = async (task: NormalTask) => {
    tap();
    const next = !task.isDone;
    setData((d) => d && { ...d, normalTasks: d.normalTasks.map((t) => (t.id === task.id ? { ...t, isDone: next } : t)) });
    try {
      await api(`/api/normal-tasks/${task.id}`, { method: 'PATCH', body: { isDone: next } });
    } catch (err) {
      setData((d) => d && { ...d, normalTasks: d.normalTasks.map((t) => (t.id === task.id ? { ...t, isDone: !next } : t)) });
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  const addTask = async () => {
    const text = newTask.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const created = await api<NormalTask>('/api/normal-tasks', { method: 'POST', body: { date: dateStr, text } });
      setData((d) => d && { ...d, normalTasks: [...d.normalTasks, created] });
      setNewTask('');
      success();
    } catch (err) {
      Alert.alert('Could not add task', errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const deleteTask = (task: NormalTask) => {
    Alert.alert('Delete task?', task.text, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/normal-tasks/${task.id}`, { method: 'DELETE' });
            setData((d) => d && { ...d, normalTasks: d.normalTasks.filter((t) => t.id !== task.id) });
          } catch (err) {
            Alert.alert('Could not delete task', errorMessage(err));
          }
        },
      },
    ]);
  };

  const toggleMed = async (type: 'morning' | 'evening') => {
    if (!data) return;
    tap();
    const current = Boolean(data.meds.todayLog?.[type]);
    const prevLog = data.meds.todayLog;
    setData((d) => d && { ...d, meds: { ...d.meds, todayLog: { morning: false, evening: false, ...d.meds.todayLog, [type]: !current } } });
    try {
      const log = await api<MedLog>('/api/meds/log', { method: 'POST', body: { date: dateStr, [type]: !current } });
      setData((d) => d && { ...d, meds: { ...d.meds, todayLog: log } });
    } catch (err) {
      setData((d) => d && { ...d, meds: { ...d.meds, todayLog: prevLog } });
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  const planDone = data?.planDays.filter((p) => p.isDone).length ?? 0;
  const tasksDone = data?.normalTasks.filter((t) => t.isDone).length ?? 0;

  return (
    <Screen>
      <Header
        title={DAY_OPTIONS.find((o) => o.offset === offset)!.label}
        subtitle={formatDay(addDays(new Date(), offset))}
        right={
          streak !== null ? (
            <View style={styles.streak}>
              <Feather name="zap" size={15} color="#fb923c" />
              <Text style={styles.streakText}>{streak} day{streak === 1 ? '' : 's'}</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.switcher}>
        {DAY_OPTIONS.map((o) => {
          const active = o.offset === offset;
          return (
            <Pressable key={o.offset} onPress={() => changeDay(o.offset)} style={[styles.switchItem, active && styles.switchItemActive]}>
              <Text style={[styles.switchText, active && { color: colors.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !data ? (
        <LoadingView color={ACCENT} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(dateStr, 'refresh')} tintColor={ACCENT} />}>
            {error ? <ErrorBanner message={error} onRetry={() => load(dateStr, data ? 'refresh' : 'initial')} /> : null}

            {data ? (
              <>
                <Card>
                  <SectionTitle
                    title="Plan"
                    icon="target"
                    color={ACCENT}
                    right={data.planDays.length ? <Text style={styles.count}>{planDone}/{data.planDays.length}</Text> : null}
                  />
                  {data.planDays.length === 0 ? <EmptyText>Nothing planned for this day.</EmptyText> : null}
                  {data.planDays.map((p) => (
                    <View key={p.id} style={styles.row}>
                      <Checkbox checked={p.isDone} color={ACCENT} onPress={() => togglePlan(p)} />
                      <Pressable style={{ flex: 1 }} onPress={() => togglePlan(p)}>
                        <Text style={[styles.rowText, p.isDone && styles.done]}>{p.topic}</Text>
                        <Text style={styles.rowMeta}>
                          {p.track}{p.planWeek ? ` · week ${p.planWeek.weekNumber}` : ''} · {p.dayLabel}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </Card>

                <Card>
                  <SectionTitle
                    title="Tasks"
                    icon="check-square"
                    color={ACCENT}
                    right={data.normalTasks.length ? <Text style={styles.count}>{tasksDone}/{data.normalTasks.length}</Text> : null}
                  />
                  {data.normalTasks.length === 0 ? <EmptyText>No tasks yet.</EmptyText> : null}
                  {data.normalTasks.map((t) => (
                    <View key={t.id} style={styles.row}>
                      <Checkbox checked={t.isDone} color={ACCENT} onPress={() => toggleTask(t)} />
                      <Pressable style={{ flex: 1 }} onPress={() => toggleTask(t)} onLongPress={() => deleteTask(t)}>
                        <Text style={[styles.rowText, t.isDone && styles.done]}>{t.text}</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteTask(t)} hitSlop={10} accessibilityLabel="Delete task">
                        <Feather name="trash-2" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.addRow}>
                    <Input
                      style={{ flex: 1 }}
                      value={newTask}
                      onChangeText={setNewTask}
                      placeholder="Add a task"
                      returnKeyType="done"
                      onSubmitEditing={addTask}
                      editable={!adding}
                    />
                    <IconButton icon="plus" label="Add task" color={ACCENT} onPress={addTask} />
                  </View>
                </Card>

                {data.meds.schedule ? (
                  <Card>
                    <SectionTitle title={data.meds.schedule.medName || 'Meds'} icon="heart" color={accents.meds} />
                    <View style={styles.medRow}>
                      {(['morning', 'evening'] as const).map((type) => {
                        const checked = Boolean(data.meds.todayLog?.[type]);
                        return (
                          <Pressable
                            key={type}
                            onPress={() => toggleMed(type)}
                            style={({ pressed }) => [
                              styles.medButton,
                              checked && { borderColor: `${accents.meds}66`, backgroundColor: `${accents.meds}14` },
                              pressed && { opacity: 0.75 },
                            ]}>
                            <Checkbox checked={checked} color={accents.meds} onPress={() => toggleMed(type)} size={22} />
                            <Text style={styles.medText}>{type === 'morning' ? 'Morning' : 'Evening'}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                ) : null}

                <Card>
                  <SectionTitle
                    title="DSA solved"
                    icon="code"
                    color={accents.dsa}
                    right={<Text style={styles.count}>{data.dsaLogs.length}</Text>}
                  />
                  {data.dsaLogs.length === 0 ? <EmptyText>No questions logged this day.</EmptyText> : null}
                  {data.dsaLogs.map((l) => (
                    <View key={l.id} style={styles.dsaRow}>
                      <Text style={styles.dsaNum}>#{l.questionNumber}</Text>
                      <Text style={[styles.rowText, { flex: 1 }]} numberOfLines={1}>{l.title || 'Loading title…'}</Text>
                      <Pill label={l.difficulty} color={difficultyColors[l.difficulty] ?? colors.textSecondary} />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, gap: space.lg, paddingBottom: space.xl * 2 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(251,146,60,0.12)',
  },
  streakText: { color: '#fdba74', fontWeight: '600', fontSize: 14 },
  switcher: {
    flexDirection: 'row',
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchItem: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  switchItemActive: { backgroundColor: `${accents.today}33` },
  switchText: { color: colors.textSecondary, fontWeight: '500', fontSize: 14 },
  count: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  rowText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  done: { color: colors.textMuted, textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  medRow: { flexDirection: 'row', gap: space.md },
  medButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  medText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  dsaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  dsaNum: { color: accents.dsa, fontWeight: '600', fontSize: 14, minWidth: 48 },
});
