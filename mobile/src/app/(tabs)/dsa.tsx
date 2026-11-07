import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyText, ErrorBanner, Header, Input, LoadingView, Pill, Screen, SectionTitle } from '@/components/ui';
import { accents, colors, difficultyColors, radius, space } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatShortDate, toLocalDateStr } from '@/lib/dates';
import { success } from '@/lib/haptics';

const ACCENT = accents.dsa;
const PAGE_SIZE = 20;

type DsaLog = { id: string; date: string; questionNumber: string; title: string; difficulty: string; notes: string };
type Stats = { Easy: number; Medium: number; Hard: number; total: number };
type LogsResponse = {
  logs: DsaLog[];
  pagination: { page: number; totalPages: number; totalLogs: number };
  dailyStats: Stats;
  weeklyStats: Stats;
  overallStats: Stats;
};

export default function DsaScreen() {
  const [logs, setLogs] = useState<DsaLog[]>([]);
  const [stats, setStats] = useState<Pick<LogsResponse, 'dailyStats' | 'weeklyStats' | 'overallStats'> | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [questionNumber, setQuestionNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<{ title: string; difficulty: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loaded = useRef(false);

  const loadFirstPage = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const data = await api<LogsResponse>(`/api/dsa-logs?page=1&limit=${PAGE_SIZE}`);
      setLogs(data.logs);
      setPage(1);
      setTotalPages(data.pagination?.totalPages || 1);
      setStats({ dailyStats: data.dailyStats, weeklyStats: data.weeklyStats, overallStats: data.overallStats });
      setError('');
      loaded.current = true;
      return data;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage(loaded.current ? 'silent' : 'initial');
    }, [loadFirstPage])
  );

  const loadMore = async () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const data = await api<LogsResponse>(`/api/dsa-logs?page=${page + 1}&limit=${PAGE_SIZE}`);
      setLogs((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...data.logs.filter((l) => !seen.has(l.id))];
      });
      setPage(page + 1);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  // Look up the LeetCode title as the number is typed (same endpoint the website uses)
  useEffect(() => {
    const num = questionNumber.trim();
    if (!/^\d+$/.test(num)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const details = await api<{ title: string; difficulty: string }>(`/api/dsa-logs/question/${num}`, { timeoutMs: 15000 });
        if (!cancelled) setPreview(details);
      } catch {
        // unknown number or slow lookup: the server fills the title in on save anyway
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [questionNumber]);

  const submit = async () => {
    const num = questionNumber.trim();
    if (!num) {
      setFormError('Enter a LeetCode question number');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      await api('/api/dsa-logs', {
        method: 'POST',
        body: {
          questionNumber: num,
          difficulty: preview?.difficulty || 'Medium',
          title: preview?.title || '',
          notes: notes.trim(),
          date: toLocalDateStr(),
        },
      });
      success();
      setQuestionNumber('');
      setNotes('');
      setPreview(null);
      const data = await loadFirstPage('silent');
      // A brand-new question may still be missing its title; check again shortly
      if (data?.logs.some((l) => !l.title)) setTimeout(() => loadFirstPage('silent'), 2000);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (log: DsaLog) => {
    Alert.alert('Delete this log?', `#${log.questionNumber} ${log.title}`.trim(), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/dsa-logs/${log.id}`, { method: 'DELETE' });
            setLogs((prev) => prev.filter((l) => l.id !== log.id));
            loadFirstPage('silent');
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          }
        },
      },
    ]);
  };

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.lg }}>
      {error ? <ErrorBanner message={error} onRetry={() => loadFirstPage(stats ? 'refresh' : 'initial')} /> : null}

      <Card>
        <SectionTitle title="Log a question" icon="plus-circle" color={ACCENT} />
        <Input
          value={questionNumber}
          onChangeText={(value) => {
            setQuestionNumber(value);
            setPreview(null);
          }}
          placeholder="LeetCode number, e.g. 1"
          keyboardType="number-pad"
          returnKeyType="done"
          editable={!submitting}
        />
        {preview ? (
          <View style={styles.preview}>
            <Text style={styles.previewTitle} numberOfLines={1}>{preview.title}</Text>
            <Pill label={preview.difficulty} color={difficultyColors[preview.difficulty] ?? colors.textSecondary} />
          </View>
        ) : null}
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          multiline
          style={styles.notesInput}
          editable={!submitting}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button title="Log question" color={ACCENT} onPress={submit} loading={submitting} style={{ marginTop: space.md }} icon="check" />
      </Card>

      {stats ? (
        <View style={styles.statsRow}>
          <Stat label="Today" value={stats.dailyStats?.total ?? 0} />
          <Stat label="This week" value={stats.weeklyStats?.total ?? 0} />
          <Stat label="All time" value={stats.overallStats?.total ?? 0} />
        </View>
      ) : null}
      {stats?.overallStats ? (
        <View style={styles.diffRow}>
          {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
            <View key={d} style={styles.diffItem}>
              <View style={[styles.dot, { backgroundColor: difficultyColors[d] }]} />
              <Text style={styles.diffText}>{d} {stats.overallStats[d]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.historyTitle}>History</Text>
    </View>
  );

  return (
    <Screen>
      <Header title="DSA" subtitle="LeetCode practice log" />
      {loading && !stats ? (
        <LoadingView color={ACCENT} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={logs}
            keyExtractor={(l) => l.id}
            ListHeaderComponent={header}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { loadFirstPage('refresh'); }} tintColor={ACCENT} />}
            ListEmptyComponent={<EmptyText>No questions logged yet.</EmptyText>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={ACCENT} style={{ marginVertical: space.lg }} /> : undefined}
            ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
            renderItem={({ item }) => (
              <View style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.logTop}>
                    <Text style={styles.logNum}>#{item.questionNumber}</Text>
                    <Text style={styles.logTitle} numberOfLines={1}>{item.title || 'Loading title…'}</Text>
                  </View>
                  <View style={styles.logMeta}>
                    <Pill label={item.difficulty} color={difficultyColors[item.difficulty] ?? colors.textSecondary} />
                    <Text style={styles.logDate}>{formatShortDate(item.date)}</Text>
                  </View>
                  {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
                </View>
                <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel="Delete log" style={styles.deleteBtn}>
                  <Feather name="trash-2" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl * 2 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, paddingHorizontal: 4 },
  previewTitle: { color: colors.text, fontSize: 14, flex: 1 },
  notesInput: { marginTop: space.md, minHeight: 72, textAlignVertical: 'top' },
  formError: { color: colors.danger, fontSize: 13, marginTop: space.sm },
  statsRow: { flexDirection: 'row', gap: space.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  statValue: { color: ACCENT, fontSize: 24, fontWeight: '600' },
  statLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  diffRow: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  diffItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  diffText: { color: colors.textSecondary, fontSize: 13 },
  historyTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logNum: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  logTitle: { color: colors.text, fontSize: 15, flex: 1 },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  logDate: { color: colors.textMuted, fontSize: 12 },
  logNotes: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  deleteBtn: { padding: 4 },
});
