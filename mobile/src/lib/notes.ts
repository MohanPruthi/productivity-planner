export type ChecklistItem = { id: string; text: string; isDone: boolean };

export type Note = {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'todo';
  checklist: ChecklistItem[] | string | null;
  colorTag?: string;
  isPersonal?: boolean;
  isPinned: boolean;
  pinnedAt?: string | null;
  updatedAt: string;
};

export function parseChecklist(value: Note['checklist']): ChecklistItem[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function newChecklistItem(text = ''): ChecklistItem {
  return { id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, isDone: false };
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

function decodeEntities(text: string) {
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

export function hasHtml(content: string) {
  return /<[a-z][\s\S]*?>/i.test(content);
}

// The web editor stores HTML. Notes that only use line/paragraph tags can be edited as plain
// text and saved back without losing anything; anything richer is shown read-only by default.
export function isPlainEditable(content: string) {
  if (!hasHtml(content)) return true;
  const tags = content.match(/<\/?([a-z0-9]+)[^>]*>/gi) || [];
  return tags.every((t) => /^<\/?(div|p|br)\s*\/?>$/i.test(t));
}

export function htmlToText(content: string) {
  if (!content) return '';
  if (!hasHtml(content)) return content;
  return decodeEntities(
    content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Saved as one <div> per line so the web editor keeps the line breaks
export function textToHtml(text: string) {
  const trimmed = text.replace(/\s+$/, '');
  if (!trimmed) return '';
  return trimmed
    .split('\n')
    .map((line) => (line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('');
}
