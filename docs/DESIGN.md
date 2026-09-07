# Sambet — Design System

This document describes the visual language of the Sambet web app (`web/`) so every
future change stays consistent with the rest of the product.

## Brand

- **Name:** Sambet — Grassroots Project member registry.
- **Mark:** the `Sprout` icon (lucide) inside a rounded tile with a `leaf-400 → leaf-700`
  diagonal gradient. The same mark appears on the landing page, login, public pages and
  the loading screen.
- **Wordmark:** `Fraunces` semibold for "Sambet" with a tiny uppercase, wide-tracked
  `Inter` subtitle ("GRASSROOTS REGISTRY" / "GRASSROOTS PROJECT").

## Color tokens (`web/tailwind.config.ts`)

| Token       | Value    | Use                                                        |
| ----------- | -------- | ---------------------------------------------------------- |
| `paper`     | `#F7F6F2` | App background — a warm, slightly green-tinted off-white |
| `ink`       | `#1C1917` | Primary text                                               |
| `ink-soft`  | `#57534E` | Secondary text                                             |
| `ink-faint` | `#A8A29E` | Tertiary text, placeholders, captions                      |
| `leaf-*`    | 50–950   | Brand green scale. Buttons/links: `700`; focus rings: `500`; tints: `50–200` |
| `bark-*`    | 800–950  | Very dark green — sidebar, login brand panel, dark CTA band |
| `gold-*`    | 100–700  | Warm accent (fees, highlights, secondary flourish)         |
| Tailwind semantics | — | `amber` = attention/pending, `rose` = danger/rejected, `sky` = neutral info, `stone` = muted surfaces |

Rules of thumb:

- Never introduce new hex colors inline; extend the palette instead.
- Green means *success/verified/registered*. Amber means *waiting/attention*. Rose means
  *rejected/failed*.
- The dark surfaces (`bark-800→950`) pair with `leaf-300` accents and white/`leaf-100`
  text at reduced opacity — never pure white blocks on dark.

## Typography

- **UI text:** `Inter` (self-hosted via `@fontsource`, weights 400/500/600/700).
- **Display:** `Fraunces` semibold (500/600/700), for page titles, hero headings, the
  wordmark and large numerals.
- Scale: body 13–16px; page titles (`font-display text-[26px]`) inside the app; public
  heroes 38–54px; step numerals in Fraunces at 40px when decorative.
- Headings use `text-balance` (see `globals.css`) to avoid orphan words; numbers use the
  `tabular` utility for stable alignment.

## Shape, elevation and motion

- **Radii:** inputs/buttons `rounded-lg/xl`, cards `rounded-2xl`, hero panels and login
  cards `rounded-3xl`. Consistent radius *within* a page section is more important than
  matching across the app.
- **Shadows:** `shadow-card` (resting cards), `shadow-card-hover` (hover lift),
  `shadow-pop` (modals/drawers/toasts), `shadow-glow` (hero mockup).
- **Motion:** `fade-up` (sections), `fade-in` (hero art), `slide-in-right` (toasts,
  drawers), `scale-in` (modals), `float` (decorative chips). Durations are 150–500ms;
  `prefers-reduced-motion` collapses all of them (enforced in `globals.css`).
- Interactive elements get `active:scale-[0.98]` press feedback and a
  `focus-visible:ring-2 ring-leaf-500` outline.

## Spacing

4-pt grid with the fractional steps the design uses (`4.5`, `5.5`, `8.5`, `9.5`) added
to the Tailwind spacing scale — these classes existed in markup but silently no-oped
before the design pass, so keep them in the config.

## Components (`web/src/components`)

| Component | Notes |
| --- | --- |
| `ui/primitives.tsx` | `Button` (primary/secondary/outline/ghost/danger × sm/md/lg, loading), `Field`, `Input`, `Textarea`, `Select`, `Badge` (stone/green/amber/rose/sky), `Card`/`CardHeader`, `Spinner`, `Skeleton`, `EmptyState`, `Segmented` |
| `ui/overlays.tsx` | `Modal`, `Drawer`, `ConfirmDialog` — Escape-to-close, focus on open |
| `ui/pagination.tsx` | Prev/next + "Page x of y" + range summary |
| `charts/charts.tsx` | `HBarChart`, `TrendBars`, `DonutChart` — no chart library, pure CSS/SVG |
| `layout/app-shell.tsx` | Dark `bark` sidebar (desktop) + mobile header/drawer; `Brand` supports `dark`/`light` tones |
| `orgs/*` | Org detail drawer and add/edit form |

## Page patterns

- **Landing** (`/`): sticky glass header → split hero (copy + registry mockup) with
  fee strip → 3-step "how it works" with dashed connectors → trust band → dark CTA
  panel → footer.
- **Login** (`/login`): split-screen; brand panel (dark, feature list, proof chips) and a
  white rounded card holding the form.
- **App pages** (`(app)/*`): page header = `font-display text-[26px]` title + one-line
  subtitle, right-aligned actions; content flows in `space-y-5/6` cards. Skeletons while
  loading, `EmptyState` for zero rows.
- **Public registration** (`/submit`): single column (`max-w-2xl`), numbered steps, fee
  callout in `leaf` tint, form card, image upload with preview, success card with the
  copyable reference.
- **Tracking** (`/track`): reference lookup → status card + `VerificationTimeline`
  (Submitted → Payment verified → Registered; the rejected state shows step 2 failed).

## Do / Don't

- Do reuse `Button`, `Badge`, `Card`, `Field` — do not hand-roll equivalents.
- Do put every interactive element's states (hover, focus-visible, disabled, active) in
  place.
- Do respect the status-color language (green/amber/rose) on badges and timelines.
- Do keep dark `bark` surfaces for brand moments only (sidebar, login panel, CTA band).
- Don't add new fonts, icon sets or libraries without updating this document.
- Don't fake data in production views — decorative mockups (like the landing hero) are
  the only exception, and they stay `aria-hidden`.
