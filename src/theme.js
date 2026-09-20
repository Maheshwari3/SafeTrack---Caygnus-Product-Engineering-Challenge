export const COLORS = {
  primary: '#2563EB', // Vibrant Blue
  secondary: '#3B82F6',
  background: '#0F172A', // Sleek Dark Mode Background
  surface: '#1E293B', // Darker Surface
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  border: '#334155',
  
  // Severity Colors
  low: '#10B981', // Emerald Green
  medium: '#F59E0B', // Amber
  high: '#EF4444', // Red
  critical: '#991B1B', // Dark Red

  // Status Colors
  synced: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
  syncing: '#3B82F6'
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  body: {
    fontSize: 16,
    color: COLORS.text,
  },
  caption: {
    fontSize: 14,
    color: COLORS.textMuted,
  }
};

export const ROUNDING = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
};
