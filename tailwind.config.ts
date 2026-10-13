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
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Micro sizes set font-size only (no line-height), matching the
        // inline text-[10px]/text-[11px] they replace. Labels inherit leading.
        '3xs': 'var(--text-3xs)',
        '2xs': 'var(--text-2xs)',
        // Full scale routed through tokens.css so DESIGN.md's type table is
        // true at runtime. xs-2xl match Tailwind defaults; 3xl-5xl follow the
        // documented editorial scale with heading/display leading tokens.
        xs: ['var(--text-xs)', { lineHeight: '1rem' }],
        sm: ['var(--text-sm)', { lineHeight: '1.25rem' }],
        base: ['var(--text-base)', { lineHeight: '1.5rem' }],
        lg: ['var(--text-lg)', { lineHeight: '1.75rem' }],
        xl: ['var(--text-xl)', { lineHeight: '1.75rem' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '2rem' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-heading)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-heading)' }],
        '5xl': ['var(--text-5xl)', { lineHeight: 'var(--leading-display)' }],
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
          control: 'hsl(var(--destructive-control))',
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
          muted: 'hsl(var(--warning-muted))',
          border: 'hsl(var(--warning-border))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          muted: 'hsl(var(--info-muted))',
          border: 'hsl(var(--info-border))',
        },
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
        overlay: 'hsl(var(--overlay))',
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
        md: 'var(--radius-inner)',
        lg: 'var(--radius-card)',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        'board-card': 'var(--radius-board-card)',
        'board-panel': 'var(--radius-board-panel)',
        nested: 'var(--radius-nested-md)',
        'nested-lg': 'var(--radius-nested-lg)',
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
      boxShadow: {
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.03), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        md: '0 4px 8px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        lg: '0 10px 20px -5px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'board-hover': 'var(--shadow-board-hover)',
        raised: 'var(--shadow-raised)',
        glass: 'var(--glass-shadow)',
        'glass-subtle': 'var(--shadow-glass-subtle)',
        'glass-deep': 'var(--shadow-glass-deep)',
        'filter-pill': '0 0 12px 0 rgb(0 0 0 / 0.06)',
      },
      zIndex: {
        background: 'var(--z-background)',
        content: 'var(--z-content)',
        'skip-link': 'var(--z-skip-link)',
        navbar: 'var(--z-navbar)',
        fab: 'var(--z-fab)',
        overlay: 'var(--z-overlay)',
        dropdown: 'var(--z-dropdown)',
        modal: 'var(--z-modal)',
        tooltip: 'var(--z-tooltip)',
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
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /** Opacity-only entry for captured evidence. Must never move layout. */
        'capture-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
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
        'pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'capture-fade': 'capture-fade 0.25s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-up-fade': 'slide-up-fade 0.4s ease-out',
        'soft-reveal': 'soft-reveal 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
