---
name: "Thaimora"
description: "A map-led property desk with clear factual panels."
colors:
  navy: "#082b46"
  blue: "#1264e8"
  green: "#11866f"
  muted: "#597082"
  line: "#e2e9ed"
  surface: "#f5f8fa"
  white: "#fff"
  blue-hover: "#074fc5"
  field-border: "#cbd8df"
  secondary-hover: "#f1f6fa"
typography:
  headline:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  explorer-heading:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
rounded:
  field: "8px"
  card: "9px"
  panel: "11px"
  dialog: "13px"
  sheet: "18px 18px 0 0"
  pin: "22px"
spacing:
  compact: "8px"
  control: "12px"
  form: "16px"
  panel: "20px"
  dialog: "24px"
  desktop: "36px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.field}"
    padding: "11px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.field}"
    padding: "11px 18px"
    height: "44px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.card}"
  nav:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    height: "79px"
---

# Design System: Thaimora

## Overview

**Creative North Star: "The Phuket Property Desk"**

Bright, bounded listing panels sit beside a working geographic surface. Navy carries factual text and map chrome, blue marks actions and selection, and green accompanies sale or availability text. The loaded Inter and Noto Sans Thai stacks keep English and Thai within the same practical vocabulary.

Density changes by context: the explorer condenses facts for comparison, while full property and editorial pages open up the same system. Borders define resting surfaces; modest shadows identify floating controls, dialogs and the phone selection sheet. The selected source world is retained without treating a preview basemap as configured satellite imagery.

**Key Characteristics:**

- Shared blue selection across pins, cards and detail.
- White factual surfaces with navy text and fine borders.
- Compact discovery; more generous standalone detail.

## Colors

### Primary

- Blue: actions, active map markers and selected cards. Blue-hover deepens primary actions.

### Secondary

- Green: availability, sale and local-discovery cues with accompanying text.

### Neutral

- Navy: primary factual text and strong chrome.
- Muted: secondary descriptions and context.
- White and surface: resting surfaces and tonal grouping.
- Line and field-border: dividers and field boundaries.
- Secondary-hover: pale response for outlined actions.

**The Shared Selection Rule.** Use blue for the selected property across its pin and card; retain textual and programmatic state alongside color.

## Typography

**Display and body fonts:** Inter, Noto Sans Thai, sans-serif. Source loads self-hosted Inter weights 400, 500, 600 and 700, and Thai 400, 500 and 600.

The normative ramp is in the frontmatter. Headings are semibold with compact negative tracking; general paragraphs use 1.65 line height. Explorer heading reduces to 25px on phones. Standalone detail headings are 31px desktop and 25px phone.

The compact listing type (11px title, 9px facts and smaller phone metadata) is observed implementation drift, not the reusable type ramp.



## Layout

The explorer caps its width at 1800px, uses 36px desktop side padding, and places a flexible map column beside a 358px detail rail with an 18px gutter. The map row is 430px high and the horizontally scrolling card strip sits below it. At 1500px and above, the rail becomes 410px and the map row 500px. The 768–1100px range uses 24px gutters and a 320px rail.

At 767px and below, 16px side gutters frame stacked search controls, a map/list switch and a 390px map. Selected detail becomes a fixed bottom sheet capped at 75vh. Mobile list cards use a 118px image column. Full property pages cap at 1060px; content at 960px; staff pages at 1260px. Two-column forms use 16px gaps and generally collapse on phones, with the editor retaining two columns for its compact fields.

## Elevation & Depth

The build uses tonal map backgrounds and thin borders for ordinary separation. Exact floating-control and modal shadows are recorded in the sidecar. The mobile detail sheet has a soft upward shadow; native dialogs use a translucent navy backdrop with 2px blur. Reduced-motion styling shortens animations and removes backdrop blur.

### Shadow Vocabulary

- **map-control:** `box-shadow: 0 3px 8px #082b461a`. Used by the corresponding map-control surface.
- **pin:** `box-shadow: 0 2px 8px #082b4630`. Used by the corresponding pin surface.
- **dialog:** `box-shadow: 0 15px 60px #082b4638`. Used by the corresponding dialog surface.
- **phone-sheet:** `box-shadow: 0 -8px 32px #082b4636`. Used by the corresponding phone-sheet surface.

**The Quiet Surface Rule.** Resting cards and panels use borders; reserve the observed soft shadows for floating controls and overlays.

## Shapes

Fields and action buttons use the field radius, cards the card radius, and selected/detail panels the panel radius. Native dialogs are slightly rounder; phone sheets round only the top corners. Price pins use capsule shapes and a small triangular pointer; clusters and favorite controls are circular. Shapes express control purpose rather than a single universal radius.

## Components

### Buttons

Solid blue, white text, semibold, with the primary padding and field radius in the frontmatter. Secondary buttons use white, navy and the field border, with a pale hover. Small and wide variants preserve the 44px minimum height. Icon buttons use SVG symbols; disabled buttons reduce opacity to 0.45. The blue focus outline is 3px with a 3px offset.

### Chips

Amenity chips use a fine border, a 5px corner, 6px 8px padding and a specific SVG plus text. Preview and availability labels describe actual state; their current small text is not a future readability baseline.

### Cards / Containers

Listing cards use white, a thin border and the card radius. Selection increases the border to 2px blue. Desktop cards are 252px wide, with a 133px image and 12px 13px 11px content padding. Image hover scales to 1.03 over 0.3s. The price precedes title, location and facts; save and compare remain independent controls.

### Inputs / Fields

White fields use the field border, field radius, 10px 12px padding and 16px input type by default. Explorer search composes these into a 52px container with an inset blue submit button. Keep explicit labels and global focus treatment; compact source overrides are not permission to shrink new form inputs.

### Navigation

A 79px desktop header groups navy wordmark, navigation and preferences. Links are 13px, weight 500; the first navigation item currently carries a 3px blue underline. At the phone breakpoint the header becomes 68px, main navigation hides, and preferences and language remain available. This first-item underline is source behavior, not a general route-aware pattern.

### Map Selection

White price pins become blue when selected; navy clusters use a white ring. Keyboard-accessible price/list controls supplement geographic interaction. Detail scrolling and the mobile bottom sheet preserve the selected record and its approximate-location notice.

## Do's and Don'ts

### Do:

- **Do** use navy for primary facts, blue for actions and selection, and green with status text.
- **Do** retain 44px control heights and visible blue focus treatment when extending existing controls.
- **Do** pair specific SVG amenity symbols with their text labels.

### Don't:

- **Don't** substitute system display fonts or text glyphs for the loaded fonts and SVG icons.
- **Don't** remove source credits, illustrative labels, preview notices or text accompanying status colors.
- **Don't** introduce decorative kickers or eyebrows.

Not canonized: remaining content-page and inquiry eyebrows, and 8–11px factual/credit text. These are craft defects or readability risks, not durable typography rules. This source record makes no full-surface WCAG, performance or live-data certification.

Source evidence: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/property-card.tsx`, `src/components/property-detail.tsx` and `src/components/explorer.tsx`. Approved PRODUCT.md identity and surface contract were read. Desktop captures were sampled during initial documentation. Final round 2 capture report (2026-10-03T11:10:06.974Z) records 7 captures, no capture errors and no detected horizontal overflow in those samples. Visual inspection of all final samples was reported by the finish pass; this documenter checked the capture report. Archive identifier: 2313e1cc5c89969b. No quality-card artifact is present under .impeccable; final capture evidence does not substitute for that evaluation. This source-derived record is not full-surface accessibility, performance, live-integration or release certification.
