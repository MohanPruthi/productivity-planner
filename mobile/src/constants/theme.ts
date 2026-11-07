export const colors = {
  background: '#0a0b10',
  surface: '#111219',
  surfaceRaised: '#191b26',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: '#f3f4f6',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  danger: '#f87171',
  success: '#30d158',
  onAmber: '#1f1300',
};

export const accents = {
  today: '#6366f1',
  dsa: '#ffa116',
  meds: '#ff2d55',
  notes: '#eab308',
  settings: '#94a3b8',
};

export type Accent = keyof typeof accents;

// Amber and yellow accents need dark text on top of them
export function onAccent(color: string) {
  return color === accents.dsa || color === accents.notes ? colors.onAmber : '#ffffff';
}

export const radius = { sm: 10, md: 12, lg: 16 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const difficultyColors: Record<string, string> = {
  Easy: '#00b8a3',
  Medium: '#ffc01e',
  Hard: '#ff375f',
};
