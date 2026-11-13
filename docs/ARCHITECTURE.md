# Buying Studio — architecture

Internal collection & buying platform: import an Open-to-Buy / line-list workbook, browse it
as an image-led catalogue, filter, group, compare and select products, and build collections
by dragging products into them.

## Vocabulary

| Term | Meaning |
|---|---|
| **Line list** | One imported workbook sheet: the vendor's offer for a brand/season (e.g. *Brand A SS27*). Read-only. |
| **Product** | One row of a line list (for the current file: one Item No = style + colour). |
| **Collection** | A buyer-built assortment drawn from one line list, organised into **groups** the buyer can reorder (capsules, drops, stories…). |
| **Selection** | A temporary multi-select used for bulk actions and the running summary. Persisted per line list. |
| **Preset** | A saved filter / search / sort / grouping combination, reusable on any line list with the same headers. |

---

## 1. Architecture

**Phase 1 is a client-side single-page app with no backend.** Everything in scope (import,
browse, filter, search, sort, group, select, collections, presets, pricing) runs in the
browser on thousands of rows faster than a server round-trip would. Data stays on the
buyer's device (IndexedDB), so nothing commercial leaves the company network. This matches the
decision that collections are per buyer, per device, for now.

What will need a server later (users, shared collections, comments, approvals) sits behind
**repository interfaces**; adding an API replaces one module, not the UI.

```
          ┌──────────────────────────────── Browser ─────────────────────────────────┐
 .xlsx ──▶│ Web Worker              Domain (pure TypeScript)        UI (React)       │
          │ read-excel-file  ──▶    import pipeline        ──▶   Import wizard       │
          │ + workbook.xml          • header-row detection        (sheet, fields,    │
          │   (hidden sheets)       • column typing               pricing check,     │
          │                         • field-role mapping          quality report)    │
          │                         • data-quality report                            │
          │                                 │                                        │
          │                                 ▼                                        │
          │  Repositories ◀────────  LineList (normalised)                           │
          │  (IndexedDB today,              │   + Settings (pricing file, materials) │
          │   HTTP API later)               ▼                                        │
          │                         Catalog index                                    │
          │                         • derived columns: Material, calculated prices   │
          │                         • dictionary-encoded facets  ──▶ Grid / Filters /│
          │                         • search haystack                Group / Detail /│
          │                         • numeric/date arrays            Collections     │
          └──────────────────────────────────────────────────────────────────────────┘
```

### Layers

| Layer | Folder | May import from | Purpose |
|---|---|---|---|
| Domain | `src/domain` | nothing app-specific | Pure functions and types. No React, no browser APIs. Unit-tested. |
| Services | `src/services` | domain | I/O boundaries: Excel worker, storage repositories, composition root (`registry.ts`). |
| State | `src/stores` | domain, services | Zustand stores: preferences, settings, library, open workspace. |
| Features | `src/features/*` | all of the above + ui | Vertical slices of the product. |
| UI kit | `src/components/ui` | lib only | Design-system primitives on Radix. No business logic. |

Dependencies only point downwards. The domain layer never knows about React or IndexedDB,
so a future backend can run the same import, pricing and grouping logic.

### Key design decisions

1. **Columns are data, not code.** Nothing refers to `"Gender"` or `"Item No"`. Every header
   becomes a `ColumnDef` with an inferred kind (`text | number | date | boolean | url | image`),
   statistics and a filter style. Numbers stored as text (style codes) stay text.
2. **Field roles bridge generic data to the buying UI.** The card needs image, style, item no,
   description, gender, category, line, colour and price; pricing needs VAT; materials need the
   composition. These are *roles*, auto-mapped from header synonyms (English + Turkish) and value
   shape, and **editable in the import wizard**. A file from another brand just maps differently.
3. **Derived columns** are computed when a line list is opened, from the roles plus settings, and
   behave exactly like file columns (filter, sort, group, search, detail):
   - *Main Material*, *Material Mix*, *Contains Material* (multi-valued) — parsed from the
     composition (`97% CO 3% EA` → Cotton / Cotton · Elastane). Code → name dictionary in Settings.
   - *Calculated prices* (e.g. a local full price) from a **private pricing file**. The app
     contains no pricing logic or numbers: the file defines each price field with an Excel-like
     formula (`ROUND`, `+ − × ÷`, `IF`, `MIN/MAX`, column references such as `PSF`, `VAT` or
     `[Any header]`), evaluated by a small safe interpreter (`domain/formula.ts`, no `eval`).
     Buyers load the file once in Settings; it is stored on their device only. The first field
     is the headline price on cards and in totals. Rounding matches Excel's `ROUND`.
4. **Every column is filterable; not every column is a headline filter.** Low-cardinality
   columns are checkbox facets; numbers with many values are range sliders; dates are bucketed by
   month; near-unique and numeric-code columns sit under "More filters". Image/URL columns are
   not filters. Facet counts are **disjunctive** (a column's counts ignore its own filter).
5. **Grouping by any column, two levels deep**, both in the catalogue (sections with counts,
   styles, average price and select-all) and inside a collection ("Arrange by…").
   Season codes order chronologically (SS26 → FW26 → SS27); blanks always come last.
6. **Collections are ordered lists of product keys inside groups.** All operations
   (add, move, reorder, regroup) are pure functions in `domain/collections.ts` returning new
   objects, which keeps undo and future server sync simple. Products that disappear from a
   line list are kept in a "Not in line list" group rather than silently dropped.
7. **Product identity = line list + key column** (auto-detected unique column, e.g. Item No).
   Selections, collections and later notes/ratings/quantities hang off the key, never off row
   positions.
8. **Precomputed index per line list.** Each filterable column is dictionary-encoded into an
   `Int32Array`; each row gets a normalised (Turkish- and accent-insensitive) search string.
   Measured on the current file: index 69 ms, filter + facet counts ~3 ms, sort + group ~2 ms.
9. **Versioned storage.** Stored line lists carry `schemaVersion`; settings are merged with
   defaults on load, so later releases can migrate rather than break saved work.

---

## 2. Technology choices

| Concern | Choice | Why | Rejected |
|---|---|---|---|
| Language | **TypeScript 7** (strict) | Requirement; the native compiler is fast. | — |
| UI | **React 19** | Largest ecosystem; `useDeferredValue` keeps search typing smooth. | Vue/Svelte: fine, smaller ecosystem for data-heavy internal tools. |
| Build | **Vite 8** | Fast, first-class Web Workers, static output deployable anywhere (IIS, nginx, Azure Static Web Apps). Routes are code-split. | **Next.js**: a server runtime adds nothing until there is a backend, and would tie the future API to Node. |
| Routing | **React Router 8** | Library ↔ catalogue ↔ collection today; dashboards, sessions, POs later. | — |
| State | **Zustand 5** | Small, selector-based (few re-renders), usable outside React. | Redux Toolkit: more ceremony than needed. |
| Excel | **read-excel-file 9** in a **Web Worker** | Maintained, small, typed. Its XML parsing blocks the thread, so it runs in our own worker (~1.9 s for the current 6-sheet file, UI stays responsive). | **SheetJS** on npm (`xlsx@0.18.5`) is abandoned with known CVEs (prototype pollution, ReDoS); the maintained build is only on SheetJS's CDN. **ExcelJS**: ~20 MB, last release 2023. |
| Hidden sheets | **fflate** | Reads `xl/workbook.xml`; read-excel-file doesn't expose sheet visibility. | — |
| Drag & drop | **@dnd-kit** (core + sortable) | Multi-container sortable lists, pointer + keyboard sensors, drag overlays. | Native HTML5 DnD: no touch, poor sortable support. |
| Virtualisation | **@tanstack/react-virtual** | Only visible card rows are in the DOM; group headers are virtual rows too. | — |
| Persistence | **IndexedDB via idb-keyval** | Survives reloads; large quota; async. | localStorage: 5 MB, synchronous (used only for small UI preferences). |
| Styling | **Tailwind CSS 4** + CSS variables | Light/dark design tokens in one place; no runtime CSS-in-JS. | — |
| Primitives | **Radix UI** | Accessible dialogs, menus, popovers, sliders, toggle groups; styled in-house. | MUI/Ant: heavy, look like generic admin software. |
| Icons / toasts | lucide-react, sonner | Small, consistent. | — |
| Fonts | Inter (UI), Instrument Serif (display) | Self-hosted via @fontsource — no external font calls from an internal tool. | — |
| Tests | **Vitest 5** | Same pipeline as Vite; domain + storage are unit-tested. | — |
| Lint | **Oxlint** | typescript-eslint doesn't support TypeScript 7 yet (requires < 6.1). Two rules are off: `no-autofocus` (focusing a dialog's first field is the WAI-ARIA pattern) and `react/incompatible-library` (only relevant with React Compiler, which isn't used). | ESLint + typescript-eslint (would force a TypeScript downgrade). |

---

## 3. Folder structure

```
buying-platform/
├── docs/                        Architecture + Excel analysis
├── public/                      Favicon
└── src/
    ├── main.tsx                 Entry point
    ├── app/                     App root: providers, routes, theme, app shell / top bar
    ├── domain/                  Pure business logic (no React, no browser APIs)
    │   ├── types.ts             LineList, ColumnDef, Collection, roles …
    │   ├── text.ts              Turkish-aware normalisation, ids
    │   ├── formula.ts           Safe Excel-like formula language for price fields
    │   ├── pricing.ts           Pricing-file format and validation, Excel ROUND
    │   ├── materials.ts         Composition parsing, material code names
    │   ├── settings.ts          Organisation settings + defaults
    │   ├── collections.ts       Collection operations (add, move, regroup …)
    │   ├── presets.ts           Header-based, cross-file filter presets
    │   ├── import/              Header detection, column typing, roles, quality, sheet scoring
    │   ├── catalog/             Index (+ derived columns), query/facets, sort/group, season order, formatting, export tables
    │   └── selection/           Buying metrics for any set of products
    ├── services/
    │   ├── registry.ts          Composition root: picks the repository implementation
    │   ├── excel/               Worker, worker client, hidden-sheet reader
    │   ├── xlsx.ts              Excel writer for exports (inline strings, links, formats; loaded on demand)
    │   └── storage/             Repository interfaces + IndexedDB / in-memory implementations
    ├── stores/                  Zustand: preferences, settings, library, workspace, ui
    ├── features/
    │   ├── library/             Line lists page (grouped by brand)
    │   ├── import/              Import wizard + dropzone
    │   ├── catalog/             Catalogue page, toolbar, virtual grid, product card
    │   ├── filters/             Filter sidebar, results bar, presets
    │   ├── product/             Detail dialog, zoom, image component
    │   ├── selection/           Selection bar, compare
    │   ├── collections/         Collections dock (drop targets), collection board
    │   └── settings/            Pricing file + material codes
    ├── components/ui/           Design-system primitives
    ├── lib/                     cn(), plural()
    └── styles/                  Tailwind entry + design tokens
```

Tests live next to the code they test (`*.test.ts`). `*.local.test.ts` files run against real
buying files and are git-ignored.

---

## 4. How the roadmap plugs in

| Future feature | Where it goes | Size |
|---|---|---|
| Multiple brands | Already modelled: `LineList.brand`, library grouped by brand. | — |
| Authentication / multiple users / shared collections | Auth provider in `app/`; implement `Repositories` over HTTP in `services/storage/http/`; switch it in `services/registry.ts`. | Medium; UI unchanged |
| Re-import an updated file, keep collections | "Update from file" on a line list: reuse the import wizard, keep the line list id. Collections already key on Item No and keep missing products visible. | Small |
| Sharing collections | **Built:** collections files (JSON) export from the Collections panel and import into another device's copy of the same line list, matched by product key. A shared server replaces the file exchange later. | — |
| Saved buying sessions | A session = `{lineListId, collections, selection, view}`; new repository + `features/sessions/`. | Small–medium |
| Notes / comments / ratings | Repositories keyed by `lineListId + productKey`; panels in the detail dialog and board cards. | Small each |
| Buy quantities, OTB budget, margin | `domain/buying/` (pure, tested) + quantity inputs on board cards; totals already flow through `summarize()`. Needs quantity/budget data the file lacks. | Medium |
| Size-level buying | Join the `Barcodes` sheet on Item No at import (second sheet in the wizard). | Medium |
| Colourways | **Built:** products sharing the style role are colours of one style (`domain/catalog/colourways.ts`); approximate swatches from colour names (`domain/colours.ts`); a brand-website link learned from one pasted example address (`domain/productLink.ts`). The website itself isn't read: it blocks automated access, and the link opens in the buyer's own browser. | — |
| Excel export | **Built:** the products shown (filters, search and sort applied), the selection, one collection or all collections. Every column, calculated prices as plain numbers, clickable photo links; collections add a summary sheet. Our own small writer on `fflate` (no library offered links + filters + frozen headers). | — |
| Photos in Excel / PDF line sheets | Embed resized photos in the Excel export (the image host allows cross-origin reads), or a print stylesheet / PDF for line sheets. | Small–medium |
| Purchase orders, approval workflow | Needs the backend (state machine, audit trail). | Large |
| Dashboard analytics | `features/dashboard/` reading the same catalog index. | Medium |

---

## 5. Scope review

You asked me to flag over-engineering:

- **Backend, auth, multi-user now: over-engineering**, and you confirmed collections are per
  buyer for now. The repository seam keeps that a contained change later.
- **Service-worker image caching: not built.** The image host's cache/CORS headers couldn't be
  verified from the build sandbox; the browser HTTP cache plus an in-memory "already loaded" set
  (no skeleton flash when scrolling back) covers the need without cache-invalidation risk.
- **"Every column as a filter" taken literally hurts usability.** All columns are filters, but
  near-unique ones (Item No, Set Code, descriptions) sit under "More filters".
- **Virtual scrolling: justified** for "thousands of products" with images.
- **Compare** (2–4 selected products side by side, differences highlighted) was included because
  the brief's objective mentions comparing; it's small.
- **Excel export** was the first thing asked for after collections; it's built (see roadmap).
  Photos are links, not embedded pictures, to keep files small.
- **Product photo weight.** Photos in the current file are full-size originals: typically
  about 0.4 MB and 1500×2090 px, up to 6 MB and 24 MP. A screen of cards was ~17 MB.
  Cards now load small copies from a resizing service (default wsrv.nl, free and
  Cloudflare-cached; Settings → Photos to turn off or point at your own server). A card copy
  is ~7–8 KB (about 50× lighter), in a few shared widths (320/640/960) so buyers share the
  cache. A copy that can't be made falls back to the original. The product view and zoom
  always show the original, with the small copy as an instant preview. On top, the loader
  (`ProductImage`) downloads only photos on screen or half a screen ahead, 10 at a time in
  the order they appear. It skips fast scrolls, cancels downloads for cards that leave, and
  retries failures twice before showing "Retry". Trade-off: the resizing service sees the
  photo addresses (they are public on the image host already). Self-hosting later means
  setting the resizer address to your own server.
- **Pricing confidentiality.** Because the app can be hosted publicly, commercial formulas
  never ship in its code; they live in the private pricing file.

---

## 6. Deployment

`npm run build` writes static files to `dist/`. Host them on any static web server and
configure it to fall back to `index.html` for unknown paths (client-side routing). Set
`BASE_PATH` (e.g. `/buying-studio/`) when the app is served from a sub-folder.

- **GitHub Pages:** `.github/workflows/deploy-pages.yml` checks, builds and publishes on every
  push to `main` (one-time setup: Settings → Pages → Source: GitHub Actions). Pages sites are
  public; no data or pricing is in the build.
- **Own servers (later):** copy `dist/` to IIS/nginx with the `index.html` fallback.
