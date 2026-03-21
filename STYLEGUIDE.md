# Vela Design System

## Brand Identity

**Vela** = sail (Spanish). Ocean/sailing narrative throughout.
Logo: turquoise sail + wave mark. Colors derive from the logomark.

---

## Colors

### Brand Palette (from logo)
| Token | Hex | Usage |
|-------|-----|-------|
| Vela Mint | `#44E1B4` | Logo top, gradient start, highlights |
| Vela Teal | `#2BC2AE` | Logo bottom, gradient end, primary accent |
| Vela Deep | `#1A9E8E` | Light mode accent, pressed states |

### Dark Mode
| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| Background | `--ocean-deep` | `#060A1F` | Page background |
| Surface | `--bg-primary` | `#0A0E27` | Card fallback |
| Glass BG | `--liquid-bg` | `rgba(255,255,255,0.04)` | Card fill |
| Glass Border | `--liquid-border` | `rgba(255,255,255,0.08)` | Card stroke |
| Text Primary | `--text-primary` | `#F0F0F5` | Headings, body |
| Text Secondary | `--text-secondary` | `#B0B4C8` | Descriptions, labels |
| Text Muted | `--text-muted` | `#7A7F97` | Timestamps, hints |
| Video Opacity | `--video-opacity` | `0.35` | Caustic background |

### Light Mode
| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| Background | `--ocean-deep` | `#EAF2F8` | Page background |
| Surface | `--bg-primary` | `#F0F4F8` | Card fallback |
| Glass BG | `--liquid-bg` | `rgba(255,255,255,0.6)` | Card fill |
| Glass Border | `--liquid-border` | `rgba(0,50,80,0.1)` | Card stroke |
| Text Primary | `--text-primary` | `#0F1A26` | Headings, body |
| Text Secondary | `--text-secondary` | `#37474F` | Descriptions, labels |
| Text Muted | `--text-muted` | `#607D8B` | Timestamps, hints |
| Video Opacity | `--video-opacity` | `0.5` | Caustic background |

### Semantic Colors
| Name | Dark | Light | Usage |
|------|------|-------|-------|
| Green | `#66BB6A` | `#2E7D32` | Profit, success |
| Red | `#EF5350` | `#C62828` | Loss, danger |
| Gold | `#FFD54F` | `#F57F17` | Warnings, pending |
| Blue | `#4FC3F7` | `#0288D1` | Info, supply actions |

---

## Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 (hero) | Inter | 700 | 5xl / 7xl (sm) |
| H2 (section) | Inter | 700 | 3xl |
| H3 (card title) | Inter | 600 | lg |
| Body | Inter | 400 | sm-base |
| Mono (values) | JetBrains Mono | 400-500 | sm |
| Label | Inter | 400 | xs, uppercase, tracking-wider |

### Text Effects
- **shimmer-text**: animated gradient sweep. Use on section titles and the "Vela" wordmark.
- **gradient-text**: static gradient. Use for secondary headings or nav logo.
- Never apply shimmer/gradient to body text or descriptions.

---

## Components

### Glass Card (`.glass`)
- Background: gradient with `--liquid-bg` and `--liquid-refract`
- Border: 1px `--liquid-border`
- Backdrop: `blur(24px) saturate(180%)`
- Radius: `20px`
- Shadow: `0 8px 32px` + inset top highlight + inset bottom depth
- `::before` specular highlight (top 50%, gradient to transparent)

### Glass Liquid (`.glass-liquid`)
- Same as `.glass` but with animated border
- Border: `conic-gradient` sweep using Vela teal tones only
- Animation: 8s linear infinite rotation
- Use for: hero CTAs, agent status card, primary action cards

### Glass Interactive (`.glass-interactive`)
- Add to any `.glass` card that's clickable/hoverable
- Hover: `translateY(-2px)` + stronger shadow + glow
- Active: `scale(0.99)` press-down
- No filter effects on hover (blurs text)

### Colored Borders
- `.glass-profit`: 3px solid green left border
- `.glass-loss`: 3px solid red left border
- `.glass-hold`: 3px solid muted left border
- `.glass-supply`: 3px solid blue left border

### Buttons
- **Primary**: `.glass-liquid` + `rounded-full` + padding
- **Secondary**: `.glass` + `rounded-full` + padding
- **Danger**: solid `--vela-red` background, white text
- All buttons: `hover:brightness-110 transition-all`
- No rainbow/multi-color borders — teal tones only

### Scroll Containers
- Use `.scroll-fade` for any scrollable list
- Applies mask-image fade at top (4%) and bottom (4%)
- Set `max-height` + `overflow-y-auto`

---

## Layout

### Backgrounds
- **Video caustics**: looping WebM, `position: fixed`, `z-index: -1`
- Dark mode: `/caustics-dark.webm` at 35% opacity
- Light mode: `/caustics-light.webm` at 50% opacity
- No CSS gradient backgrounds — the video is the background

### Header
- Sticky, `backdrop-filter: blur(16px)`, semi-transparent `--ocean-deep`
- Logo (24px) + shimmer wordmark left, controls right
- Theme toggle always present

### Spacing
- Page padding: `px-4 sm:px-6`
- Max content width: `max-w-6xl` (dashboard), `max-w-5xl` (landing features), `max-w-3xl` (how it works)
- Section padding: `py-16` (landing), `py-6` (dashboard)
- Card padding: `p-6` (standard), `p-4` (compact/activity)
- Gap: `gap-6` between cards

### Radius
- Cards: `20px`
- Buttons: `rounded-full` (pill) or `rounded-lg` (inputs)
- Badges: `rounded-full`
- Theme toggle: `12px`

---

## Motion

### Spring Defaults
- **Card entrance**: `type: "spring", stiffness: 120, damping: 20`
- **Hover**: `type: "spring", stiffness: 400, damping: 25`
- **Page content**: `type: "spring", stiffness: 80, damping: 20`

### Entrance Patterns
- Cards: `initial={{ opacity: 0, y: 30 }}` with staggered delay
- Activity items: `initial={{ opacity: 0, y: 40 }}` (bubble up)
- Sections: use `useInView` with `once: true` for scroll-triggered

### Animations
- **shimmer**: 4s ease-in-out infinite (text gradient sweep)
- **sonar-pulse**: 2s ease-out infinite (green active dot)
- **rainbow-spin**: 8s linear infinite (glass-liquid border)
- **hover-shake**: 0.3s ease-in-out on hover (danger buttons)

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce`.
Video background hidden, all keyframes stopped.

---

## Icons
- Inline SVG, 28x28 for feature cards, 18x18 for UI controls
- `stroke="currentColor"`, `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"`
- No emoji in UI — always SVG line icons
- Color inherits from parent (use text color classes)

---

## Do / Don't

### Do
- Use CSS variables for all colors
- Match accent elements to logo teal (`#44E1B4` → `#2BC2AE`)
- Keep copy user-focused (value, not technology)
- Test in both light and dark mode
- Add `relative z-10` to content inside glass cards (above `::before`)

### Don't
- Use rainbow/multi-color borders — stick to teal tones
- Apply SVG filters to text or interactive elements (causes blur)
- Use `border-image` with `border-radius` (they conflict)
- Add new color tokens without updating both light and dark mode
- Use opacity below 0.04 for glass backgrounds (invisible)
- Write technical jargon in user-facing copy
