import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        xl: '1280px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border-subtle))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted: 'hsl(var(--success-muted))',
          border: 'hsl(var(--success-border))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: 'hsl(var(--info))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          muted: 'hsl(var(--brand-muted))',
          border: 'hsl(var(--brand-border))',
          hover: 'hsl(var(--brand-hover))',
        },
        link: {
          DEFAULT: 'hsl(var(--link))',
          hover: 'hsl(var(--link-hover))',
        },
        'focus-ring': 'hsl(var(--focus-ring))',
        terminal: {
          DEFAULT: 'hsl(var(--terminal))',
          foreground: 'hsl(var(--terminal-foreground))',
          muted: 'hsl(var(--terminal-muted))',
          border: 'hsl(var(--terminal-border))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        grade: {
          A: 'hsl(var(--grade-A))',
          B: 'hsl(var(--grade-B))',
          C: 'hsl(var(--grade-C))',
          D: 'hsl(var(--grade-D))',
          F: 'hsl(var(--grade-F))',
        },
      },
      borderRadius: {
        sm: 'var(--radius-input)',
        md: 'calc(var(--radius-inner))',
        lg: 'var(--radius-modal)',
        xl: 'var(--radius-outer)',
        card: 'var(--radius-card)',
        nested: 'var(--radius-nested-md)',
        pill: 'var(--radius-pill)',
      },
      letterSpacing: {
        display: 'var(--tracking-display)',
        heading: 'var(--tracking-heading)',
        body: 'var(--tracking-body)',
        label: 'var(--tracking-label)',
      },
      lineHeight: {
        display: 'var(--leading-display)',
        heading: 'var(--leading-heading)',
        body: 'var(--leading-body)',
        relaxed: 'var(--leading-relaxed)',
      },
      backgroundImage: {
        'gradient-score': 'var(--gradient-score)',
        'gradient-score-bar': 'var(--gradient-score-bar)',
        'gradient-peach-surface': 'var(--gradient-surface)',
        'gradient-peach-accent': 'var(--gradient-accent-text)',
        'gradient-orb-peach': 'var(--gradient-orb-peach)',
        'gradient-orb-brand': 'var(--gradient-orb-brand)',
        'gradient-orb-warm': 'var(--gradient-orb-warm)',
        'gradient-orb-coral': 'var(--gradient-orb-coral)',
      },
      boxShadow: {
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.03), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        md: '0 4px 8px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        lg: '0 10px 20px -5px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        raised: 'var(--shadow-raised)',
        glass: 'var(--glass-shadow)',
        filterPill: '0 0 12px 0 rgb(0 0 0 / 0.06)',
      },
      zIndex: {
        background: '-1',
        content: '10',
        navbar: '50',
        dropdown: '100',
        modal: '200',
        tooltip: '300',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-reveal': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'word-reveal': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'loop-progress': {
          from: { opacity: '0', transform: 'scaleX(0)' },
          to: { opacity: '1', transform: 'scaleX(1)' },
        },
        'peach-drift-a': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '25%': { transform: 'translate(8%, -6%) scale(1.08)' },
          '50%': { transform: 'translate(3%, 4%) scale(0.96)' },
          '75%': { transform: 'translate(-6%, -3%) scale(1.04)' },
        },
        'peach-drift-b': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '30%': { transform: 'translate(-9%, 5%) scale(1.06)' },
          '60%': { transform: 'translate(6%, -8%) scale(0.94)' },
          '85%': { transform: 'translate(-3%, 2%) scale(1.02)' },
        },
        'peach-breathe': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.06)' },
        },
        'peach-surface-shift': {
          '0%, 100%': { backgroundPosition: '0% 40%' },
          '50%': { backgroundPosition: '100% 60%' },
        },
        'card-glow-pulse': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-up-fade': 'slide-up-fade 0.4s ease-out',
        'soft-reveal': 'soft-reveal 0.2s ease-out',
        'word-reveal': 'word-reveal 0.5s ease-out',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'gradient-shift-slow': 'gradient-shift 7s ease infinite',
        'loop-progress': 'loop-progress 0.7s var(--ease-out) 0.12s both',
        'peach-drift-a': 'peach-drift-a 22s ease-in-out infinite',
        'peach-drift-b': 'peach-drift-b 30s ease-in-out infinite',
        'peach-breathe': 'peach-breathe 14s ease-in-out infinite',
        'peach-surface-shift': 'peach-surface-shift 18s ease-in-out infinite',
        'card-glow-pulse': 'card-glow-pulse 6s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
