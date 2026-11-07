import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Checkbox, ErrorBanner, IconButton, LoadingView, PressableScale } from '@/components/ui';
import { accents, colors, onAccent, radius, space } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { success, tap } from '@/lib/haptics';
import {
  ChecklistItem,
  hasHtml,
  htmlToText,
  isPlainEditable,
  newChecklistItem,
  Note,
  parseChecklist,
  textToHtml,
} from '@/lib/notes';

const ACCENT = accents.notes;

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [type, setType] = useState<'note' | 'todo'>('note');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [contentEditable, setContentEditable] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(
    () =>
      api<Note>(`/api/notes/${id}`)
        .then((data) => {
          setNote(data);
          setType(data.type === 'todo' ? 'todo' : 'note');
          setTitle(data.title);
          setText(htmlToText(data.content || ''));
          setContentEditable(isPlainEditable(data.content || ''));
          setItems(parseChecklist(data.checklist).filter((i) => i.text.trim()));
          setError('');
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false)),
    [id]
  );

  useEffect(() => {
    if (!isNew) load();
  }, [isNew, load]);

  // Leave once a save/delete has cleared the unsaved-changes guard
  useEffect(() => {
    if (leaving && !dirty) router.back();
  }, [leaving, dirty]);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert('Discard changes?', 'You have unsaved changes to this note.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const edit = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  const buildContent = () => {
    const original = note?.content || '';
    // Plain text that came from the website stays plain (it may be markdown)
    if (note && original && !hasHtml(original)) return text;
    return textToHtml(text);
  };

  const buildChecklist = () => {
    const kept = items.filter((i) => i.text.trim());
    return kept.length ? kept : [newChecklistItem()];
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'Notes need a title before they can be saved.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api<Note>('/api/notes', {
          method: 'POST',
          body: {
            title: title.trim(),
            type,
            content: type === 'note' ? textToHtml(text) : '',
            checklist: type === 'todo' ? buildChecklist() : [],
            colorTag: ACCENT,
            isPersonal: false,
            isPinned: false,
          },
        });
        success();
        setDirty(false);
        setLeaving(true);
        return;
      }
      const body: Record<string, unknown> = { title: title.trim() };
      if (type === 'todo') body.checklist = buildChecklist();
      else if (contentEditable) body.content = buildContent();
      const saved = await api<Note>(`/api/notes/${id}`, { method: 'PATCH', body });
      setNote(saved);
      setDirty(false);
      success();
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (itemId: string) => {
    tap();
    const next = items.map((i) => (i.id === itemId ? { ...i, isDone: !i.isDone } : i));
    setItems(next);
    if (isNew) {
      setDirty(true);
      return;
    }
    try {
      await api(`/api/notes/${id}`, { method: 'PATCH', body: { checklist: next.filter((i) => i.text.trim()) } });
    } catch (err) {
      setItems(items);
      Alert.alert('Could not update', errorMessage(err));
    }
  };

  const addItem = () => {
    const value = newItem.trim();
    if (!value) return;
    setItems((prev) => [...prev, newChecklistItem(value)]);
    setNewItem('');
    setDirty(true);
  };

  const togglePin = async () => {
    if (!note) return;
    tap();
    try {
      const updated = await api<Note>(`/api/notes/${note.id}/pin`, { method: 'PATCH' });
      setNote((n) => (n ? { ...n, isPinned: updated.isPinned, pinnedAt: updated.pinnedAt } : n));
    } catch (err) {
      Alert.alert('Could not pin', errorMessage(err));
    }
  };

  const remove = () => {
    if (!note) return;
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/notes/${note.id}`, { method: 'DELETE' });
            setDirty(false);
            setLeaving(true);
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          }
        },
      },
    ]);
  };

  const unlockRichContent = () => {
    Alert.alert(
      'Edit as plain text?',
      'This note uses formatting from the website (lists, bold, headings). Saving it here keeps the text but removes that formatting.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit anyway', onPress: () => setContentEditable(true) },
      ]
    );
  };

  const headerRight = () => (
    <View style={styles.headerActions}>
      {note ? (
        <>
          <IconButton icon="bookmark" label={note.isPinned ? 'Unpin' : 'Pin'} color={note.isPinned ? ACCENT : colors.textSecondary} onPress={togglePin} />
          <IconButton icon="trash-2" label="Delete note" onPress={remove} />
        </>
      ) : null}
      <PressableScale
        onPress={save}
        disabled={saving || (!dirty && !isNew)}
        style={[styles.saveButton, (saving || (!dirty && !isNew)) && { opacity: 0.45 }]}>
        {saving ? <ActivityIndicator color={onAccent(ACCENT)} size="small" /> : <Text style={styles.saveText}>Save</Text>}
      </PressableScale>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: isNew ? 'New note' : '', headerRight }} />
      {loading ? (
        <LoadingView color={ACCENT} />
      ) : error && !note ? (
        <View style={{ padding: space.lg }}>
          <ErrorBanner
            message={error}
            onRetry={() => {
              setLoading(true);
              load();
            }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {isNew ? (
              <View style={styles.typeSwitch}>
                {(['note', 'todo'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[styles.typeItem, type === t && { backgroundColor: `${ACCENT}26` }]}>
                    <Feather name={t === 'todo' ? 'list' : 'file-text'} size={15} color={type === t ? ACCENT : colors.textSecondary} />
                    <Text style={[styles.typeText, type === t && { color: colors.text }]}>{t === 'todo' ? 'Checklist' : 'Note'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextInput
              value={title}
              onChangeText={edit(setTitle)}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              style={styles.title}
              multiline
              keyboardAppearance="dark"
              selectionColor={ACCENT}
            />
            {note ? <Text style={styles.meta}>Updated {formatShortDate(note.updatedAt)}</Text> : null}

            {type === 'todo' ? (
              <View style={{ marginTop: space.lg }}>
                {items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Checkbox checked={item.isDone} color={ACCENT} onPress={() => toggleItem(item.id)} size={22} />
                    <TextInput
                      value={item.text}
                      onChangeText={(value) => {
                        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, text: value } : i)));
                        setDirty(true);
                      }}
                      style={[styles.itemInput, item.isDone && styles.itemDone]}
                      keyboardAppearance="dark"
                      selectionColor={ACCENT}
                      multiline
                    />
                    <Pressable
                      hitSlop={10}
                      accessibilityLabel="Remove item"
                      onPress={() => {
                        setItems((prev) => prev.filter((i) => i.id !== item.id));
                        setDirty(true);
                      }}>
                      <Feather name="x" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.itemRow}>
                  <Feather name="plus" size={20} color={ACCENT} style={{ width: 22, textAlign: 'center' }} />
                  <TextInput
                    value={newItem}
                    onChangeText={setNewItem}
                    placeholder="Add an item"
                    placeholderTextColor={colors.textMuted}
                    style={styles.itemInput}
                    returnKeyType="done"
                    submitBehavior="submit"
                    onSubmitEditing={addItem}
                    onBlur={addItem}
                    keyboardAppearance="dark"
                    selectionColor={ACCENT}
                  />
                </View>
              </View>
            ) : contentEditable ? (
              <TextInput
                value={text}
                onChangeText={edit(setText)}
                placeholder="Start writing…"
                placeholderTextColor={colors.textMuted}
                style={styles.body}
                multiline
                scrollEnabled={false}
                keyboardAppearance="dark"
                selectionColor={ACCENT}
              />
            ) : (
              <View style={{ marginTop: space.lg }}>
                <Pressable onPress={unlockRichContent} style={styles.richNotice}>
                  <Feather name="lock" size={14} color={colors.textSecondary} />
                  <Text style={styles.richNoticeText}>Formatted on the website. Tap to edit as plain text.</Text>
                </Pressable>
                <Text style={styles.bodyReadOnly} selectable>{text || 'This note is empty.'}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xl * 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    height: 36,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: onAccent(ACCENT), fontWeight: '600', fontSize: 15 },
  typeSwitch: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
  },
  typeItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.sm },
  typeText: { color: colors.textSecondary, fontWeight: '500', fontSize: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', padding: 0 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: space.xs },
  body: { color: colors.text, fontSize: 16, lineHeight: 24, marginTop: space.lg, minHeight: 240, textAlignVertical: 'top', padding: 0 },
  bodyReadOnly: { color: colors.text, fontSize: 16, lineHeight: 24, marginTop: space.md },
  richNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  richNoticeText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInput: { flex: 1, color: colors.text, fontSize: 16, padding: 0 },
  itemDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
