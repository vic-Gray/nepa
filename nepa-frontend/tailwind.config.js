module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background))',
        foreground: 'rgb(var(--color-foreground))',
        muted: {
          DEFAULT: 'rgb(var(--color-muted))',
          foreground: 'rgb(var(--color-muted-foreground))',
        },
        popover: {
          DEFAULT: 'rgb(var(--color-popover))',
          foreground: 'rgb(var(--color-popover-foreground))',
        },
        card: {
          DEFAULT: 'rgb(var(--color-card))',
          foreground: 'rgb(var(--color-card-foreground))',
        },
        border: 'rgb(var(--color-border))',
        input: 'rgb(var(--color-input))',
        primary: {
          DEFAULT: 'rgb(var(--color-primary))',
          foreground: 'rgb(var(--color-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary))',
          foreground: 'rgb(var(--color-secondary-foreground))',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent))',
          foreground: 'rgb(var(--color-accent-foreground))',
        },
        destructive: {
          DEFAULT: 'rgb(var(--color-destructive))',
          foreground: 'rgb(var(--color-destructive-foreground))',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning))',
          foreground: 'rgb(var(--color-warning-foreground))',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success))',
          foreground: 'rgb(var(--color-success-foreground))',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info))',
          foreground: 'rgb(var(--color-info-foreground))',
        },
        ring: 'rgb(var(--color-ring))',
        chart: {
          '1': 'rgb(var(--color-chart-1))',
          '2': 'rgb(var(--color-chart-2))',
          '3': 'rgb(var(--color-chart-3))',
          '4': 'rgb(var(--color-chart-4))',
          '5': 'rgb(var(--color-chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
