import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Checkbox, EmptyText, ErrorBanner, Header, LoadingView, PressableScale, Screen } from '@/components/ui';
import { accents, colors, onAccent, radius, space } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { tap } from '@/lib/haptics';
import { htmlToText, Note, parseChecklist } from '@/lib/notes';

const ACCENT = accents.notes;

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await api<Note[]>('/api/notes');
      setNotes(sortNotes(data));
      setError('');
      loaded.current = true;
    } catch (err) {
      setError(errorMessage(err));
      if (!loaded.current) setNotes([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleItem = async (note: Note, itemId: string) => {
    tap();
    const updated = parseChecklist(note.checklist).map((i) => (i.id === itemId ? { ...i, isDone: !i.isDone } : i));
    setNotes((prev) => prev && prev.map((n) => (n.id === note.id ? { ...n, checklist: updated } : n)));
    try {
      await api(`/api/notes/${note.id}`, { method: 'PATCH', body: { checklist: updated } });
    } catch {
      load();
    }
  };

  return (
    <Screen>
      <Header
        title="Notes"
        subtitle={notes ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : undefined}
        right={
          <PressableScale
            onPress={() => router.push('/note/new')}
            style={styles.newButton}
            accessibilityLabel="New note">
            <Feather name="plus" size={18} color={onAccent(ACCENT)} />
            <Text style={styles.newButtonText}>New</Text>
          </PressableScale>
        }
      />
      {notes === null ? (
        <LoadingView color={ACCENT} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={ACCENT} />}
          ListHeaderComponent={error ? <View style={{ marginBottom: space.md }}><ErrorBanner message={error} onRetry={() => load(true)} /></View> : undefined}
          ListEmptyComponent={!error ? <EmptyText>No notes yet. Tap New to write one.</EmptyText> : undefined}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          renderItem={({ item }) => <NoteCard note={item} onToggleItem={toggleItem} />}
        />
      )}
    </Screen>
  );
}

function NoteCard({ note, onToggleItem }: { note: Note; onToggleItem: (note: Note, itemId: string) => void }) {
  const isTodo = note.type === 'todo';
  const checklist = parseChecklist(note.checklist).filter((i) => i.text.trim());
  const done = checklist.filter((i) => i.isDone).length;
  const preview = isTodo ? '' : htmlToText(note.content);

  return (
    <PressableScale onPress={() => router.push(`/note/${note.id}`)} style={styles.card}>
      <View style={styles.cardTop}>
        <Feather name={isTodo ? 'list' : 'file-text'} size={15} color={ACCENT} />
        <Text style={styles.cardTitle} numberOfLines={1}>{note.title}</Text>
        {note.isPinned ? <Feather name="bookmark" size={15} color={ACCENT} /> : null}
      </View>

      {isTodo ? (
        <View style={{ marginTop: space.sm }}>
          {checklist.length === 0 ? <Text style={styles.preview}>No checklist items</Text> : null}
          {checklist.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.item}>
              <Checkbox checked={item.isDone} color={ACCENT} size={20} onPress={() => onToggleItem(note, item.id)} />
              <Text style={[styles.itemText, item.isDone && styles.itemDone]} numberOfLines={1}>{item.text}</Text>
            </View>
          ))}
          {checklist.length > 4 ? <Text style={styles.more}>+{checklist.length - 4} more</Text> : null}
        </View>
      ) : preview ? (
        <Text style={styles.preview} numberOfLines={3}>{preview}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.meta}>{formatShortDate(note.updatedAt)}</Text>
        {isTodo && checklist.length ? <Text style={styles.meta}>{done}/{checklist.length} done</Text> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl * 2 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  newButtonText: { color: onAccent(ACCENT), fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  preview: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 },
  itemText: { color: colors.text, fontSize: 14, flex: 1 },
  itemDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  more: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  meta: { color: colors.textMuted, fontSize: 12 },
});
