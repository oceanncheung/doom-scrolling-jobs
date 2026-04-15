# Design System: Editorial Grid

## 1. Visual Theme & Atmosphere

This system is rooted in the Swiss International Typographic Style — the design tradition behind the EMOP Berlin photography calendar, Guggenheim exhibition pages, and broadsheet program layouts. The page operates as a structured information surface: a white canvas partitioned by 1px horizontal and vertical rules into a rigid 12-column grid. There is no decoration. Structure comes entirely from lines, type hierarchy, and deliberate white space.

The visual identity is monochromatic with a single accent. The palette is black (`#000000`), white (`#FFFFFF`), a controlled grey scale, and one chartreuse accent (`#D4E700`) used exclusively for active/hover states and selective highlights. No gradients, no shadows, no rounded corners. Depth is communicated through background-color zoning (white → light grey → white), never through elevation or blur.

Typography does all the heavy lifting. IBM Plex Sans is the primary typeface — its engineered letterforms were designed for both UI precision and editorial expression. At display sizes, weight 300 (Light) creates an airy, restrained headline quality that counterbalances information density. At body and compact sizes, weight 400 (Regular) with micro letter-spacing (0.16px at 14px, 0.32px at 12px) ensures readability in dense layouts. IBM Plex Mono serves as the supplementary typeface for data values, timestamps, fit scores, and any machine-readable content — giving those elements a distinct functional texture against the sans-serif body.

Every element snaps to the same spatial rhythm. Spacing follows a strict base-8 scale. Rows and sections are separated by 1px rules, not padding gaps. Cards don't float — they sit inside grid cells divided by hairlines. The information density is high but never cluttered because the grid does the organizational work.

**Key Characteristics:**
- IBM Plex Sans as the primary typeface — weight 300 (Light) at display sizes, 400 (Regular) for body, 500 (Medium) for labels, 600 (SemiBold) for emphasis
- IBM Plex Mono as supplementary — data values, scores, timestamps, codes
- Monochromatic palette: black, white, greys + single chartreuse accent (`#D4E700`)
- 1px horizontal rules as primary section dividers — not padding, not shadows
- 12-column CSS Grid with 24px gutters as the structural backbone
- 0px border-radius on everything — no softening, no pills, no rounded corners
- Uppercase + wide tracking (`0.08em`) for all labels, categories, and metadata
- Micro letter-spacing at small sizes: 0.16px at 14px, 0.32px at 12px (the Plex signature)
- Background-color zoning for section separation (white ↔ grey-100)
- No shadows, no gradients, no decorative elements of any kind

## 2. Color Palette & Roles

### Primary
- **Black** (`#000000`): Primary text, headings, rules, strong borders, nav background. `--color-black`.
- **White** (`#FFFFFF`): Page background, card surfaces, inverse text on dark. `--color-white`.
- **Accent Chartreuse** (`#D4E700`): Active tab state, hover highlights, primary CTA. `--color-accent`. This is the only chromatic hue in the system.

### Neutral Scale (Grey Family)
- **Grey 900** (`#161616`): Near-black for dark surfaces (dark nav, footer, dark sections). `--color-grey-900`.
- **Grey 800** (`#262626`): Secondary dark surfaces, hover on dark backgrounds. `--color-grey-800`.
- **Grey 600** (`#525252`): Secondary text, descriptions, helper text. `--color-grey-600`.
- **Grey 400** (`#A3A3A3`): Placeholder text, disabled states, muted metadata. `--color-grey-400`.
- **Grey 200** (`#E5E5E5`): Primary border/rule color, divider lines, table borders. `--color-grey-200`.
- **Grey 100** (`#F5F5F5`): Secondary surface, alternating section fills, active tab background, card hover. `--color-grey-100`.
- **Grey 100 Hover** (`#EBEBEB`): Hover state for grey-100 surfaces. `--color-grey-100-hover`.

### Interactive
- **Accent** (`#D4E700`): Active navigation tab background, primary CTA background. `--color-accent`.
- **Accent Hover** (`#BFD100`): Darkened accent for hover on accent elements. `--color-accent-hover`.
- **Accent Muted** (`#D4E70020`): 12% opacity accent for subtle active row indicators. `--color-accent-muted`.

### Accent Application Rules
- Active navigation tab: accent background (`#D4E700`) with black text
- Primary CTA button: accent background with black text
- Selected/active list rows: subtle 2px left-border in accent
- Links: black by default, underline on hover — NOT accent-colored
- Never use accent as text color on white backgrounds (insufficient contrast)
- Never use accent decoratively — it always signals an active or interactive state

### Support & Status
- **Red** (`#DA1E28`): Error, danger, destructive. `--color-error`.
- **Green** (`#24A148`): Success, confirmation. `--color-success`.
- **Amber** (`#F1C21B`): Warning, caution. `--color-warning`.
- **Blue** (`#0F62FE`): Informational notices. `--color-info`.

## 3. Typography Rules

### Font Family
- **Primary**: `'IBM Plex Sans', 'Helvetica Neue', 'Arial', sans-serif`
- **Monospace**: `'IBM Plex Mono', 'Menlo', 'Courier New', monospace`
- No serif. No display fonts. IBM Plex Sans handles the full hierarchy. IBM Plex Mono handles all data/machine content.

### Available Weights
- **300 (Light)**: Display headlines only (32px and above). Creates editorial lightness at large sizes.
- **400 (Regular)**: Body text, descriptions, standard reading content.
- **500 (Medium)**: Labels, metadata, nav items, button text. The workhorse UI weight.
- **600 (SemiBold)**: Card titles, section headings, emphasis, column values.
- **700 (Bold)**: Page titles, hero headlines, app title. Use sparingly.
- Weight 700 is intentionally rare — the scale favors 300→400→500→600 for most hierarchy.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Text Transform | Notes |
|------|------|------|--------|-------------|----------------|----------------|-------|
| Display | Plex Sans | 42px (2.625rem) | 300 | 1.17 (49px) | 0 | none | Hero headlines, page titles. Light weight for editorial elegance. |
| Heading 01 | Plex Sans | 32px (2rem) | 300 | 1.2 (38px) | 0 | none | Major section titles. Light weight continues at this size. |
| Heading 02 | Plex Sans | 24px (1.5rem) | 600 | 1.25 (30px) | 0 | none | Sub-section titles, sidebar headings. |
| Heading 03 | Plex Sans | 20px (1.25rem) | 600 | 1.3 (26px) | 0 | none | Card titles, feature headers. |
| Body | Plex Sans | 16px (1rem) | 400 | 1.5 (24px) | 0 | none | Standard reading text. |
| Body Emphasis | Plex Sans | 16px (1rem) | 600 | 1.5 (24px) | 0 | none | Bold body, inline emphasis. |
| Small | Plex Sans | 14px (0.875rem) | 400 | 1.4 (20px) | 0.16px | none | Secondary text, table cells, descriptions. Micro-tracking opens Plex at this size. |
| Small Emphasis | Plex Sans | 14px (0.875rem) | 600 | 1.4 (20px) | 0.16px | none | Column data values, nav items, emphasized small text. |
| Label | Plex Sans | 12px (0.75rem) | 500 | 1.33 (16px) | 0.08em | uppercase | Category tags, column headers, metadata, dates, times. The editorial signature. |
| Label Large | Plex Sans | 14px (0.875rem) | 500 | 1.3 (18px) | 0.08em | uppercase | Section labels, nav tab labels. |
| Caption | Plex Sans | 12px (0.75rem) | 400 | 1.33 (16px) | 0.32px | none | Fine print, footnotes, score numbers, freshness indicators. |
| Mono Data | Plex Mono | 14px (0.875rem) | 400 | 1.4 (20px) | 0.16px | none | Fit scores, timestamps, numerical data, IDs. |
| Mono Label | Plex Mono | 12px (0.75rem) | 500 | 1.33 (16px) | 0.08em | uppercase | Technical labels, data column headers where a monospace feel is desired. |
| App Title | Plex Mono | 14px (0.875rem) | 700 | 1.3 (18px) | 0.04em | none | Application title in nav bar. Mono distinguishes the app name from content. |

### Principles
- **Light weight at display sizes**: Weight 300 at 32px+ creates the signature editorial feel — restrained, airy, authoritative. This is the Plex sweet spot.
- **Micro-tracking at small sizes**: 0.16px letter-spacing at 14px and 0.32px at 12px. These values open up the tight Plex letterforms at compact sizes for readability.
- **Wide tracking on labels**: 0.08em on uppercase labels and metadata. Every date, category, column header uses this treatment.
- **Mono for data, Sans for narrative**: Any value that could appear in a spreadsheet (scores, dates, numbers, codes) uses Plex Mono. Everything else uses Plex Sans. This creates a clear visual distinction between data and description.
- **No weight 700 in body context**: Bold (700) is reserved for the app title and page-level display headlines only. Card titles and section headings use SemiBold (600).

## 4. Component Stylings

### Buttons

**Primary Button (Accent)**
- Background: `#D4E700` (Accent) → `--color-accent`
- Text: `#000000` (Black)
- Font: 14px Plex Sans, weight 500, letter-spacing 0.08em, uppercase
- Padding: 12px 24px
- Height: 48px
- Border: none
- Border-radius: 0px
- Hover: `#BFD100` → `--color-accent-hover`
- Active: `#A8B800`
- Transition: background-color 150ms ease

**Secondary Button (Black)**
- Background: `#000000`
- Text: `#FFFFFF`
- Font: 14px Plex Sans, weight 500, letter-spacing 0.08em, uppercase
- Padding: 12px 24px
- Border-radius: 0px
- Hover: `#262626` (Grey 800)

**Ghost Button (Outlined)**
- Background: transparent
- Text: `#000000`
- Border: 1px solid `#000000`
- Padding: 12px 24px
- Border-radius: 0px
- Hover: `#000000` background, `#FFFFFF` text
- Transition: all 150ms ease

**Text Button / Action Link (Save, Skip, Update)**
- Background: none
- Text: `#000000`
- Border: none
- Padding: 12px 0
- Font: 14px Plex Sans, weight 600, letter-spacing 0.16px
- Text-decoration: none default, underline on hover
- These are inline action labels, not boxed buttons

Implementation note:
- Shared button reset and centering mechanics belong to `app/styles/controls.css`.
- Surface styles should only change placement, sizing, or variant appearance when needed; they should not fork the base button contract.

### Cards & Job Listings
- Background: `#FFFFFF`
- Border-bottom: `1px solid #E5E5E5` (Grey 200) separating each card
- Border-radius: 0px
- Internal padding: 24px vertical, aligned to grid columns horizontally
- Hover (if clickable): background shifts to `#F5F5F5` (Grey 100)
- No shadow — ever
- Cards are separated by rules, not by vertical gaps
- Action row (Save/Skip): separated by `1px solid #E5E5E5` top border, split at midpoint by vertical rule

### Table / Schedule Rows (Data Listing Pattern)
- Row structure: title block (left, wider) + metadata columns (right, narrower)
- Metadata column headers: Label style (12px, uppercase, 0.08em tracking, Plex Sans, Grey 600)
- Metadata values: Small Emphasis (14px, weight 600, Plex Sans) or Mono Data (14px, Plex Mono) for scores/numbers
- Row border: `1px solid #E5E5E5` bottom on every row
- Row hover: `#F5F5F5` background
- Active/selected row: `2px solid #D4E700` left border

### Inputs & Forms
- Background: `#FFFFFF`
- Border: `1px solid #E5E5E5` (Grey 200)
- Border-radius: 0px
- Height: 48px
- Padding: 0 16px
- Font: 16px Plex Sans, weight 400
- Focus: `1px solid #000000` border
- Error: `1px solid #DA1E28` border
- Label: 12px Plex Sans, weight 500, letter-spacing 0.08em, uppercase, Grey 600, margin-bottom 8px
- Placeholder: Grey 400 (`#A3A3A3`)

### Navigation Bar

**Structure:**
- Full-width bar, white background, 48px height
- Bottom border: `1px solid #E5E5E5` (Grey 200) — separates nav from content
- App title: far left, Plex Mono 14px weight 700, letter-spacing 0.04em, black
- Navigation tabs: center or left-of-center, evenly spaced
- User profile indicator: far right

**Tab States:**
- Inactive tab: 14px Plex Sans, weight 500, letter-spacing 0.08em, uppercase, black text, no background. Padding: 12px 24px. Full 48px height.
- Hover tab: `#F5F5F5` (Grey 100) background
- Active tab: `#D4E700` (Accent) background, black text. This is the clear active-page indicator — the chartreuse makes it unmistakable.
- Tab counts (e.g., "6" in "Potential6"): same style as tab label, no separation. Or: use Plex Mono for the number to distinguish it from the label text.

**User Profile Indicator:**
- Distinct from navigation tabs — this is identity, not navigation
- Treatment: `1px solid #000000` outlined container (ghost style), black text, no fill
- Font: 14px Plex Sans, weight 500, letter-spacing 0.08em, uppercase
- Hover: `#000000` fill, `#FFFFFF` text (inverts to solid)
- This outlined style clearly separates it from the filled active tab and the plain inactive tabs
- Alternatively: plain text with a small user icon prefix, separated from tabs by a vertical rule or generous gap

### Links
- Default: `#000000` (Black), no underline
- Hover: `#000000`, underline
- Within body text: underline by default for discoverability
- No color change for links — identified by context and underline, not by blue

### Horizontal Rules (Key Structural Element)
- Default rule: `1px solid #E5E5E5` (Grey 200) → `--border-default`
- Strong rule: `1px solid #000000` (Black) → `--border-strong`
- Section dividers: strong rules between major sections
- Row dividers: default rules between list/table items
- Rules replace padding as the primary visual separator throughout

**Workspace column hairlines (implementation):** In the main queue column, content is often inset with `padding-right: var(--queue-column-pad)` while the column may have no right padding. A hairline on a **full-width section** (`<section>`) can use `left: calc(-1 * var(--queue-column-pad)); width: calc(100% + var(--queue-column-pad));` so the rule meets the right edge. For a **nested** block whose `width: 100%` is only the **inner content** box (already inset on both sides by the column’s horizontal padding), use `left: calc(-1 * var(--queue-column-pad)); width: calc(100% + (2 * var(--queue-column-pad)));` so the same black rule runs flush to the column edges. Do not stack two top rules for the same boundary—use one `::before` (e.g. on a stack) or one child section line, not both.

Implementation note:
- In code, prefer the shared edge-bleed variables from `app/styles/controls.css` over repeating the raw `calc(...)` expressions in each surface file.

### Sidebar Components
- Section container: no background, separated by `1px solid #E5E5E5` bottom border
- Section label ("Today", "Source"): Label style (12px, uppercase, 0.08em tracking, Grey 600)
- Section title ("Apply next", "Snapshot", "Resume status"): Heading 02 or 03
- Stat rows: Small (14px) text left, Mono Data (14px Plex Mono) value right-aligned
- Action links ("Update"): Text Button style

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: `4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 128px`
- Component internal padding: typically 16px or 24px
- Gap between grid items: 24px (gutter)
- Section vertical spacing: 48px (standard), 64px–96px (major transitions)
- No arbitrary values — every spacing declaration must map to this scale

### Grid & Container
- 12-column CSS Grid
- Max content width: 1280px, centered with auto margins
- Column gutters: 24px
- Page margin: 48px (desktop), 24px (tablet), 16px (mobile)
- Content typically spans 8–10 columns for readable line lengths
- Sidebar: 3–4 columns. Main content: 8–9 columns.

### Layout Patterns

**Two-Panel Dashboard (Current App Pattern)**
- Left panel: ~3-4 columns — sidebar with summary cards, status, actions
- Right panel: ~8-9 columns — primary content feed (job listings, data tables)
- Separated by a 1px vertical rule or column gap with visual separation
- On mobile: stacks vertically, sidebar above main content
- Sidebar has a fixed or sticky position on desktop

**Card Feed (Job Listings)**
- Full width of the right panel
- Each card: title block + metadata columns in a sub-grid row
- Action row below each card, split into two halves by a vertical rule
- Horizontal rule between every card — no vertical spacing gaps

**Alternating Section Bands**
- Full-bleed background alternating white → grey-100 → white
- Content within each band constrained to max-width container
- Strong rule at top of each band

### Whitespace Philosophy
- **Rules over padding**: Sections are defined by 1px lines, not by spacing gaps. Whitespace appears between elements within ruled containers, never as ambiguous gaps between sections.
- **Functional density**: Information density is a feature. The dashboard/screening aesthetic means content is packed tight, organized by the grid and rules.
- **Consistent vertical rhythm**: Body line-height (24px) establishes vertical rhythm. All spacing aligns to multiples of 8px.

### Border Radius Scale
- **0px**: Everything. No exceptions. The system is fundamentally rectangular.

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Default) | No shadow, `#FFFFFF` background | Default page surface |
| Surface 01 | No shadow, `#F5F5F5` background | Sidebar sections, alternating zones, hover states |
| Surface 02 | No shadow, `#E5E5E5` background | Nested elements within Surface 01 |
| Dark Surface | No shadow, `#000000` or `#161616` background | Dark feature sections, footer |
| Ruled | `1px solid #E5E5E5` border | Card edges, row separators, section dividers |
| Ruled Strong | `1px solid #000000` border | Major section breaks, nav bottom border |
| Focus | `2px solid #000000` outline, 2px offset | Keyboard focus indicator |
| Active Indicator | `2px solid #D4E700` left or bottom border | Active item in list/nav |

**Shadow Philosophy**: Zero shadows. No `box-shadow`, no `drop-shadow`, no `text-shadow`. Depth comes from background-color layering and 1px rules. For floating elements (modals, dropdowns), use a dark scrim overlay (`rgba(0,0,0,0.5)`) with the element on a white surface — still no shadow. This flatness references print design.

## 7. Do's and Don'ts

### Do
- Use IBM Plex Sans as the primary typeface for all UI text
- Use IBM Plex Mono for data values, scores, timestamps, numbers, and the app title
- Use weight 300 (Light) at display sizes (32px+) for editorial elegance
- Apply 0.16px letter-spacing on 14px text and 0.32px on 12px text
- Use uppercase + 0.08em tracking on all labels, column headers, dates, and metadata
- Use 1px horizontal rules between every row, card, and section
- Keep all border-radius at 0px — rectangles are the identity
- Use accent (#D4E700) only for active tab state and primary CTA
- Use the outlined (ghost) style for the user profile indicator to distinguish from nav tabs
- Maintain the base-8 spacing scale for all padding, margin, and gap values
- Use Plex Mono for numerical data to visually separate it from descriptive text

### Don't
- Don't add box-shadow to any element
- Don't round any corners — 0px border-radius everywhere
- Don't introduce a second accent color
- Don't use padding alone to separate sections — always include a visible rule
- Don't use accent as link color — links are black with underline hover
- Don't use weight 700 (Bold) below 32px — card titles and section heads use 600
- Don't add letter-spacing to display/heading text — tracking is only for 14px and below
- Don't center-align text unless it's a single-line hero statement
- Don't use gradients, blurs, glows, or decorative CSS effects
- Don't deviate from the spacing scale — no 10px, 15px, 20px, 30px

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | 320px | Single column, 16px margins, sidebar stacks above content |
| Tablet | 768px | Two-panel layout begins, 24px margins |
| Desktop | 1024px | Full 12-column grid, full nav visible |
| Wide | 1280px | Max content width reached, centered |

### Touch Targets
- Button height: 48px minimum
- Navigation tabs: 48px row height
- Table/card rows: 48px minimum height
- Input height: 48px
- Action links (Save/Skip): 48px touch target minimum

### Collapsing Strategy
- Two-panel → stacks vertically (sidebar above content)
- Navigation tabs → hamburger with slide-out or overlay
- Metadata columns within cards → stack vertically or hide secondary columns
- Display type: 42px → 32px → 24px
- Section spacing: 64px → 48px → 32px
- Page margins: 48px → 24px → 16px

### Image Behavior
- All images: `max-width: 100%`, maintain aspect ratio
- No border-radius on images
- Rectangular containers only

## 9. Agent Prompt Guide

### Quick Color Reference
- Page background: White (`#FFFFFF`)
- Heading text: Black (`#000000`)
- Body text: Black (`#000000`)
- Secondary text: Grey 600 (`#525252`)
- Label/metadata text: Grey 600 (`#525252`), uppercase
- Surface/card fill: Grey 100 (`#F5F5F5`)
- Border/rule (default): Grey 200 (`#E5E5E5`)
- Border/rule (strong): Black (`#000000`)
- Primary CTA: Accent (`#D4E700`) bg, Black text
- Active nav tab: Accent (`#D4E700`) bg, Black text
- Profile indicator: 1px solid Black border, no fill, Black text
- Link default: Black, no underline
- Link hover: Black, underline
- Error: Red (`#DA1E28`)
- Success: Green (`#24A148`)

### Quick Font Reference
- App title: IBM Plex Mono, 14px, weight 700, 0.04em tracking
- Nav tabs: IBM Plex Sans, 14px, weight 500, 0.08em tracking, uppercase
- Page heading: IBM Plex Sans, 42px, weight 300, line-height 1.17
- Section heading: IBM Plex Sans, 32px, weight 300, line-height 1.2
- Card title: IBM Plex Sans, 20px, weight 600, line-height 1.3
- Body: IBM Plex Sans, 16px, weight 400, line-height 1.5
- Small text: IBM Plex Sans, 14px, weight 400, 0.16px tracking
- Labels/metadata: IBM Plex Sans, 12px, weight 500, 0.08em tracking, uppercase
- Data values/scores: IBM Plex Mono, 14px, weight 400, 0.16px tracking
- Captions: IBM Plex Sans, 12px, weight 400, 0.32px tracking

### Example Component Prompts
- "Create a navigation bar: white background, 48px height, 1px solid #E5E5E5 bottom border. App title far left in IBM Plex Mono 14px weight 700, 0.04em tracking, #000000. Tabs: 14px Plex Sans weight 500, uppercase, 0.08em tracking. Inactive tabs: #000000 text, no background. Active tab: #D4E700 background, #000000 text. User profile indicator far right: 1px solid #000000 outlined container, 14px uppercase, no fill. Profile hover: inverts to #000000 fill, #FFFFFF text."
- "Create a job listing card: title at 20px Plex Sans weight 600, #000000. Company name below at 14px weight 400, #525252. Metadata columns right-aligned: headers at 12px Plex Sans weight 500 uppercase 0.08em tracking #525252, values at 14px Plex Sans weight 600 #000000. Fit score value in Plex Mono 14px. Description at 14px weight 400 #525252. Action row below: Save and Skip as 14px weight 600 text buttons separated by a 1px vertical rule. Card separated by 1px solid #E5E5E5 bottom border."
- "Build a sidebar section: label at 12px Plex Sans uppercase weight 500 0.08em tracking #525252. Title at 20px Plex Sans weight 600 #000000. Stat rows: 14px Plex Sans weight 400 label left, 14px Plex Mono weight 400 value right-aligned. Section separated by 1px solid #E5E5E5 bottom border."

### Iteration Guide
1. IBM Plex Sans for all text; IBM Plex Mono for data values, scores, numbers, timestamps, and app title
2. Weight 300 at 32px+ for display, weight 600 for titles/emphasis, weight 500 for labels/UI, weight 400 for body
3. 0.16px letter-spacing at 14px, 0.32px at 12px, 0.08em on uppercase labels — never on display text
4. 1px rules between every row, card, and section — this is the defining visual pattern
5. Border-radius is 0px on everything — no exceptions
6. Accent (#D4E700) for active tab and primary CTA only — never decorative
7. User profile uses outlined (ghost) container — not filled like the active tab
8. Shadows do not exist in this system
9. Spacing uses the base-8 scale only: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
10. When in doubt, add a rule. Missing lines are the #1 cause of visual disconnection.
