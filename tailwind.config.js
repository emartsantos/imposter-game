/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        imposter: {
          red: "#dc2626",
          "red-dark": "#b91c1c",
          "red-light": "#f87171",
          dark: "#1e293b",
          darker: "#0f172a",
          accent: "#6366f1",
          gold: "#d97706",
          "gold-dark": "#b45309",
          green: "#16a34a",
          "green-dark": "#15803d",
          purple: "#7c3aed",
          "purple-dark": "#6d28d9",
          blue: "#2563eb",
          surface: "#fafafa",
          "surface-light": "#ffffff",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 24px rgba(220, 38, 38, 0.2)",
        "glow-lg": "0 0 48px rgba(220, 38, 38, 0.3)",
        "glow-green": "0 0 24px rgba(22, 163, 74, 0.2)",
        "glow-gold": "0 0 24px rgba(217, 119, 6, 0.2)",
        "glow-purple": "0 0 24px rgba(124, 58, 237, 0.2)",
        glass: "0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
        "glass-hover": "0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)",
        float: "0 16px 48px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)",
        "inner-glow": "inset 0 1px 2px rgba(255, 255, 255, 0.6)",
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-slow": "bounce 2s infinite",
        shake: "shake 0.4s ease-in-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "fade-in-up": "fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in-down": "fadeInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        "card-flip": "cardFlip 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        wiggle: "wiggle 0.3s ease-in-out",
        countdown: "countdown 1s ease-in-out",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(220, 38, 38, 0.15)" },
          "50%": { boxShadow: "0 0 20px rgba(220, 38, 38, 0.3)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        cardFlip: {
          from: { transform: "rotateY(0deg)" },
          to: { transform: "rotateY(180deg)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-2deg)" },
          "75%": { transform: "rotate(2deg)" },
        },
        countdown: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [],
};
