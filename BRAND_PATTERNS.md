# Vehkit Brand Patterns

**Mission:** every car deserves a passport. **Visual ethos:** PropertyFinder-grade
restraint, Instagram-skeleton column, mobile-first, UAE-confident. Every new page
ships against this doc.

If a pattern below is missing on a surface, it's not done.

---

## 1. Palette tokens

Reference these by name, never by hex. They live in CSS variables (light + dark
themes both defined).

| Token    | Role                                                |
| -------- | --------------------------------------------------- |
| `noir`   | Primary background — near-black                     |
| `chalk`  | Primary text — warm white                           |
| `ash`    | Secondary text, micro-labels, supporting copy       |
| `iron`   | Card surfaces, neutral buttons                      |
| `seam`   | Borders, dividers (always 1px)                      |
| `volt`   | Single accent — electric lime, restrained           |
| `wallet` | Premium variant, "expiring soon", gold cues         |
| `signal` | Errors, expired states, destructive                 |
| `carbon` | Deep gradients, hover layers                        |

Active states use **volt as a thin underline or 2px indicator**, never a flooded
pill background. Premium / "due soon" cues use **wallet**. Errors / expired use
**signal** sparingly.

---

## 2. The 10 PF signals

Every page should hit at least 7 of these. Three or fewer = not done.

1. **Kicker line** above the title: `<p className="nav-pill">vehkit · {context}</p>`
   in `text-[10px] tracking-widest uppercase text-ash`. (e.g. `vehkit · agent`)
2. **Tight title** in `text-xl md:text-2xl font-semibold tracking-tighter`. Larger
   only on hero / marketing.
3. **Supporting line** under the title — one sentence of editorial copy that
   tells the reader *why this page exists*. Not just "Vehicle list."
4. **Stat strip with vertical dividers** for any numeric summary:
   `<span className="w-px bg-seam shrink-0" aria-hidden />` between stats.
   Stat values in `text-sm md:text-base font-semibold`, labels in
   `text-[10px] tracking-widest uppercase text-ash mt-1`.
5. **List rows in cards** — `card p-4` or `card p-5`, never bare `<li>`. Layout:
   avatar/icon (40px circular) + content stack + right-aligned action cluster.
6. **Intelligence line** under the title in list items — "Last service · 2 days
   ago at ASM German" rather than just plain subtitle. Tells you *why this row
   matters*, not just *what it is*.
7. **Action clusters** are 36px circular buttons (`w-9 h-9 rounded-pill`),
   never chunky text pills. Icons at 14–16px. Tone-coded by intent.
8. **Filter chips inline with search** when filtering applies. Live counts
   (`<span className="font-mono tabular-nums">{n}</span>`).
9. **Editorial empty states** — title + 1 supporting line + single CTA. Never
   "No data." See `app/mycars/page.tsx` empty state for the reference shape.
10. **Pill-shaped buttons** (`rounded-pill`). Primary = `pill-primary`, ghost =
    `pill-ghost`, outline = `pill-outline`. No square corners on actions.

---

## 3. Skeleton conventions

- **Column-bound on desktop**: `max-w-3xl mx-auto px-6` for content; `max-w-5xl`
  only for B2B dashboards (workshop, agent) which need horizontal density.
- **Mobile bottom nav** for consumer + B2B portals. Sticky top nav on desktop.
- **Section spacing**: `mt-8` between major sections, `mt-3` between rows in a
  list, `mt-2` for sub-rows beneath an item.
- **No edge-to-edge full bleed** except hero photos. The brand stays in its
  column.

---

## 4. Email templates

Already aligned. When adding new templates, mirror `emailWorkshopEntryToOwner`:
- Volt-accented kicker ("vehkit"),
- Bordered detail card,
- Single pill CTA,
- Tagline footer ("Every car deserves a passport").

---

## 5. Anti-patterns — never ship these

- Plain `text-3xl` headers with no kicker
- Pill-flooded active nav states (`bg-iron text-chalk`)
- Stat rows separated by `·` dots in plain prose instead of vertical-divider strips
- "View" / "Edit" rendered as text links inside dense rows when 36px icon buttons would do
- Empty states that read "No vehicles found" — write *editorial* copy
- `bullet → text` lists when a stat-card grid would communicate the same in less space
- Hex colours hardcoded in markup. Use tokens.
- New emoji decorations. The brand is restrained.

---

## 6. Reference surfaces (canonical)

When in doubt, copy the rhythm from these:

| Surface              | What to study                                  |
| -------------------- | ---------------------------------------------- |
| `/`                  | Hero kicker + supporting + stat strip rhythm   |
| `/mycars`            | Editorial header + intelligence line + filter chips |
| `/vehicles/[id]`     | Section headers + card list + sticky CTA       |
| `ServiceRecordRow`   | List-item layout: avatar + content + actions   |
| `MyCarsList`         | Card body + intelligence line + stat strip     |
| `emailWorkshopEntryToOwner` | Branded email rhythm                    |

When you finish a new surface, mentally diff against the closest reference. If
you can't say "this looks like it belongs in the same product," go again.
