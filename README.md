# Buying Studio

Internal collection & buying platform for the buying team. Import an OTB / line-list workbook
and work with it as a visual catalogue instead of a spreadsheet:

- **Import any layout.** All sheets are scored and the product sheet is picked automatically. Headers, column types, the image column and field mapping are detected, and a data-quality report is shown before import.
- **Visual catalogue.** Lazy-loaded product images, virtual scrolling, light and dark mode.
- **Filters from every column.** Multi-select with value search, ranges for numbers, month buckets for dates. Counts show what each option would match. Presets can be saved and reused on next season's file.
- **Global search across every column.** It ignores accents and Turkish letters, so `istanbul` finds `İSTANBUL`.
- **Sorting** by any column; season codes sort in season order.
- **Grouping by any column, two levels deep.** This includes **Main Material**, parsed from the composition codes (`97% CO 3% EA` → Cotton).
- **Calculated prices** (e.g. a local full price) from a **private pricing file** your team distributes. The app itself contains no pricing formulas or numbers, so it can be hosted publicly.
- **Selection** that survives filtering and reloads, with a running summary: products, styles, retail value, average.
- **Product detail view** with every field, click-to-zoom and ←/→ navigation. Compare 2–4 products side by side.
- **Collections.** Drag products (or the whole selection) from the catalogue into collections. On a collection's board, reorder products, move them between groups, or arrange the groups by any column. Share collections as a file (Collections panel → ⋯ → Export / Import); products are matched by their key, e.g. Item No.

Everything runs in the browser. Imported data, collections and settings are stored on the
buyer's device (IndexedDB); nothing is uploaded.

## Getting started

Requires Node.js 20+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 and drop an `.xlsx` file on the page.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build static files into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (domain logic and storage) |
| `npm run lint` | Oxlint |
| `npm run check` | Type-check + lint + tests |

To check the import pipeline against a real workbook without committing it, create a test file
named `*.local.test.ts` under `src/` (git-ignored) and pass the file path in an environment
variable.

## Pricing file

Prices are calculated from a JSON file that is shared privately and loaded once per device
(Settings → Pricing → Load pricing file). Example with made-up numbers:

```json
{
  "format": "buying-studio-pricing",
  "version": 1,
  "priceColumnCurrency": "EUR",
  "fields": [
    { "name": "Full Price", "currency": "GBP", "decimals": 0, "formula": "ROUND(PSF / (1 + VAT) * 0.5, 0)" }
  ]
}
```

Formulas support numbers, `+ - * / ^`, parentheses, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `MIN`,
`MAX`, `ABS`, `IF` and comparisons. `PSF` and `VAT` refer to the mapped retail price and VAT
columns; any other column can be used as `[Header name]`. Arguments may be separated with `,`
or `;`. Never commit a real pricing file to a public repository.

## Deploying

`npm run build` produces a static site in `dist/`. Serve it from any web server with a fallback
to `index.html` for unknown paths. When it is served from a sub-folder, build with
`BASE_PATH=/folder-name/`.

**GitHub Pages:** pushing to `main` runs `.github/workflows/deploy-pages.yml`, which checks,
builds and publishes the site. One-time setup in the repository: Settings → Pages → Source:
**GitHub Actions**. GitHub Pages sites are public; the build contains no buying data or pricing.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture, technology choices, folder structure, roadmap seams, scope review
