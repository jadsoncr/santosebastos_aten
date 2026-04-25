import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#FFFFFF',
        'bg-surface': '#F7F7F5',
        'bg-surface-hover': '#F0EFE9',
        border: '#E8E7E1',
        accent: '#1A73E8',
        'accent-hover': '#1557B0',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B6B6B',
        'text-muted': '#ADADAD',
        'text-on-accent': '#FFFFFF',
        error: '#EF4444',
        success: '#1DB954',
        warning: '#F59E0B',
        'score-hot': '#991B1B',
        'score-warm': '#D97706',
        'score-cold': '#475569',
        'sidebar-bg': '#FAFAF8',
        'chat-received': '#F7F7F5',
        'chat-sent': '#EBF3FE',
        'note-internal': '#FFFBEB',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      spacing: {
        sidebar: '240px',
        header: '56px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}

export default config
