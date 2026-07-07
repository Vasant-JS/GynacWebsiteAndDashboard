---
name: FemmeCare
colors:
  surface: '#fbf8ff'
  surface-dim: '#d5d7ff'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2ff'
  surface-container: '#edecff'
  surface-container-high: '#e6e6ff'
  surface-container-highest: '#e0e0ff'
  on-surface: '#000767'
  on-surface-variant: '#5a4044'
  inverse-surface: '#1b247f'
  inverse-on-surface: '#f1efff'
  outline: '#8e6f74'
  outline-variant: '#e3bdc3'
  surface-tint: '#bc004f'
  primary: '#b0004a'
  on-primary: '#ffffff'
  primary-container: '#d81b60'
  on-primary-container: '#fff2f3'
  inverse-primary: '#ffb2bf'
  secondary: '#006a62'
  on-secondary: '#ffffff'
  secondary-container: '#81f3e5'
  on-secondary-container: '#006f66'
  tertiary: '#6941ab'
  on-tertiary: '#ffffff'
  tertiary-container: '#825bc6'
  on-tertiary-container: '#fbf3ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9de'
  primary-fixed-dim: '#ffb2bf'
  on-primary-fixed: '#3f0016'
  on-primary-fixed-variant: '#90003b'
  secondary-fixed: '#84f5e8'
  secondary-fixed-dim: '#66d9cc'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ebdcff'
  tertiary-fixed-dim: '#d4bbff'
  on-tertiary-fixed: '#260058'
  on-tertiary-fixed-variant: '#572e99'
  background: '#fbf8ff'
  on-background: '#000767'
  surface-variant: '#e0e0ff'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 16px
  container-padding-desktop: 48px
  gutter: 24px
  section-gap: 64px
---

## Brand & Style
The design system is built on the pillars of empathy, clinical excellence, and serenity. It serves a demographic seeking both expert medical guidance and a safe, welcoming environment. The visual direction follows a **Corporate/Modern** aesthetic with **Minimalist** influences to reduce cognitive load during potentially stressful medical interactions.

The emotional response should be one of "assured calm." By utilizing generous whitespace and a soft, refined color palette, the UI moves away from the cold, sterile feel of traditional medical software toward a premium, boutique healthcare experience. High-quality imagery, subtle transitions, and clear information hierarchy reinforce the brand's position as a modern leader in women's health.

## Colors
The palette is rooted in a sophisticated "Warm Rose" primary tone, which provides a compassionate feminine touch without feeling juvenile. This is balanced by a "Muted Teal" secondary color, which introduces a sense of clinical stability and health-focused professionalism.

- **Primary (#D81B60):** Used for primary actions, branding, and highlighting critical health pathways.
- **Secondary (#26A69A):** Used for "success" states, health metrics, and secondary navigation elements.
- **Text/Neutral (#1A237E):** A deep navy used for all core typography to ensure maximum legibility and an authoritative tone.
- **Surface/Background (#FAFAFA):** A soft, off-white to reduce screen glare and create a warm, paper-like quality.
- **Accent (#F3E5F5):** Light lavender is used for subtle container backgrounds and soft highlights to differentiate sections without adding visual noise.

## Typography
**Manrope** is selected as the sole typeface for the design system. Its modern, geometric structure offers the precision required for medical data, while its open terminals and balanced proportions maintain a friendly, approachable character.

Scale is used to establish a strict hierarchy. Headlines use a bold weight with slightly tighter letter-spacing to appear more cohesive and premium. Body text relies on the Regular (400) weight for long-form reading, ensuring patient information and medical results are highly accessible. Label styles are set in SemiBold or Bold to distinguish metadata and button text from body content.

## Layout & Spacing
The layout follows a **Fixed Grid** model on desktop (12 columns, 1200px max-width) to maintain a sense of order and institutional reliability. On mobile devices, the system transitions to a fluid 4-column layout.

Spacing is based on an 8px baseline rhythm. This consistent increment ensures that medical charts and patient dashboards feel structured and easy to scan. Large "Section Gaps" are used to separate distinct functional areas (e.g., separating "Upcoming Appointments" from "Historical Records") to prevent the user from feeling overwhelmed by data.

## Elevation & Depth
Depth in the design system is communicated through **Tonal Layers** and **Ambient Shadows**. Surfaces do not "float" aggressively; instead, they sit subtly above the background to indicate interactivity.

- **Level 0 (Background):** Soft White (#FAFAFA).
- **Level 1 (Cards/Main Surface):** Pure White (#FFFFFF) with a very soft, diffused shadow (0px 4px 20px rgba(26, 35, 126, 0.05)).
- **Level 2 (Modals/Overlays):** Pure White (#FFFFFF) with a more defined shadow and a 20% background dimming overlay to focus patient attention.
- **Interactive States:** Buttons and clickable cards use a subtle "lift" effect (y-axis shift) rather than a heavy shadow change to maintain a clean, premium feel.

## Shapes
A **Rounded** shape language is employed to soften the clinical nature of the platform. All standard UI components like input fields, buttons, and cards utilize a 0.5rem (8px) corner radius. 

Larger containers, such as promotional banners or patient summary cards, may use the `rounded-xl` (24px) setting to create a "container" feel that suggests safety and enclosure. Circularity is reserved strictly for user avatars and status indicators (badges) to provide a distinct visual contrast against structural elements.

## Components

### Buttons & Inputs
- **Primary Action:** Solid "Warm Rose" with white text. High contrast is essential for accessibility.
- **Secondary Action:** Outlined "Muted Teal" for non-critical paths like "View History."
- **Inputs:** Use a 1px border in a lightened Navy tint. On focus, the border thickens to 2px in the Primary color with a subtle Lavender glow.

### Medical Cards
Cards are the primary vehicle for data. They feature a white background, 8px corner radius, and a subtle "Muted Teal" left-accent border for "active" medical files. Content within cards should have a minimum of 24px internal padding to ensure readability.

### Status Badges
Status indicators use a pill-shaped geometry with a light tinted background and dark foreground text:
- **Booked:** Light Teal background / Dark Teal text.
- **Completed:** Light Grey background / Navy text.
- **Urgent:** Light Rose background / Deep Rose text.

### Professional Tables
Tables must be "clean." No vertical borders; use only 1px horizontal dividers in a very light neutral. Header rows should be set in `label-sm` with a light Lavender background to distinguish them from the data rows.

### Accessibility
All interactive elements must maintain a minimum hit target of 44x44px. Color contrast for all text against backgrounds must pass WCAG AA standards, particularly when using the Primary Rose and Secondary Teal.