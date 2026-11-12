import { AlertTriangle, Check, EyeOff, ImageIcon, Info, Sheet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlays'
import { Badge, Input, Select, Spinner } from '@/components/ui/primitives'
import { formatCell } from '@/domain/catalog/format'
import { finalizeLineList, recheckQuality, type LineListDraft, type WorkbookAnalysis } from '@/domain/import/analyze'
import { buildCatalogIndex } from '@/domain/catalog/buildIndex'
import { FIELD_ROLES, ROLE_LABELS, type ColumnKind, type FieldRole, type RoleMap } from '@/domain/types'
import { cn } from '@/lib/cn'
import { ImportSession } from '@/services/excel/importSession'
import { knownBrands, useLibrary } from '@/stores/library'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { Dropzone, isExcelFile } from './Dropzone'

type Step = { kind: 'pick' } | { kind: 'reading'; fileName: string } | { kind: 'review'; file: File; analysis: WorkbookAnalysis }

const ROLE_KINDS: Partial<Record<FieldRole, ColumnKind[]>> = {
  image: ['image', 'url'],
  price: ['number'],
  vat: ['number'],
}

const ROLE_HINTS: Partial<Record<FieldRole, string>> = {
  key: 'Identifies each product; keeps collections stable when you re-import.',
  price: 'Shown as PSF; available to pricing-file formulas as PSF.',
  vat: 'Available to pricing-file formulas as VAT.',
  composition: 'Parsed into Main Material, Material Mix and Contains Material.',
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
}

export function ImportDialog({ open, onOpenChange, initialFile }: { open: boolean; onOpenChange: (o: boolean) => void; initialFile?: File | null }) {
  const navigate = useNavigate()
  const lineLists = useLibrary((s) => s.lineLists)
  const addLineList = useLibrary((s) => s.add)

  const session = useRef<ImportSession | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [error, setError] = useState<string | null>(null)
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [draft, setDraft] = useState<LineListDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [roles, setRoles] = useState<RoleMap>({})
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    session.current?.dispose()
    session.current = null
    setStep({ kind: 'pick' })
    setError(null)
    setDraft(null)
    setSheetName(null)
    setSaving(false)
  }

  const close = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const loadSheet = async (sheet: string) => {
    if (!session.current) return
    setSheetName(sheet)
    setLoadingDraft(true)
    try {
      const d = await session.current.draft(sheet)
      setDraft(d)
      setRoles(d.roles)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingDraft(false)
    }
  }

  const readFile = async (file: File) => {
    setError(null)
    if (!isExcelFile(file)) {
      setError('Please choose an Excel .xlsx file.')
      return
    }
    session.current?.dispose()
    session.current = new ImportSession()
    setStep({ kind: 'reading', fileName: file.name })
    try {
      const analysis = await session.current.analyze(file)
      setStep({ kind: 'review', file, analysis })
      setName(baseName(file.name))
      const first = analysis.recommended ?? analysis.sheets[0]?.name
      if (first) await loadSheet(first)
    } catch (e) {
      setError((e as Error).message)
      setStep({ kind: 'pick' })
    }
  }

  const initialRead = useRef<File | null>(null)
  useEffect(() => {
    if (open && initialFile && initialRead.current !== initialFile) {
      initialRead.current = initialFile
      void readFile(initialFile)
    }
    // readFile is stable for this purpose; we only react to a new initial file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile])

  const quality = useMemo(() => (draft ? recheckQuality(draft.columns, draft.rows, roles) : []), [draft, roles])

  const confirm = async () => {
    if (step.kind !== 'review' || !draft) return
    setSaving(true)
    try {
      const lineList = finalizeLineList(draft, { name, brand: brand || null, fileName: step.file.name, roles })
      await addLineList(lineList)
      toast.success(`Imported ${lineList.rows.length.toLocaleString('en-GB')} products`)
      close(false)
      navigate(`/l/${lineList.id}`)
    } catch (e) {
      setError(`Could not save the line list: ${(e as Error).message}`)
      setSaving(false)
    }
  }

  const reviewing = step.kind === 'review'

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Import line list"
      description={reviewing ? step.file.name : 'Products are read on your device; nothing is uploaded.'}
      className={reviewing ? 'h-[min(860px,92dvh)] max-w-5xl' : 'max-w-xl'}
      footer={
        reviewing ? (
          <>
            <span className="mr-auto text-xs text-muted">{draft ? `${draft.rows.length.toLocaleString('en-GB')} products · ${draft.columns.length} columns` : ''}</span>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirm} disabled={!draft || loadingDraft || saving || draft.rows.length === 0}>
              {saving && <Spinner className="size-3.5" />}
              Import {draft ? draft.rows.length.toLocaleString('en-GB') : ''} products
            </Button>
          </>
        ) : undefined
      }
    >
      {step.kind === 'pick' && (
        <div className="p-6">
          <Dropzone onFile={readFile} />
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}

      {step.kind === 'reading' && (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <Spinner className="size-6 text-muted" />
          <p className="font-medium">Reading {step.fileName}</p>
          <p className="text-sm text-muted">Large workbooks with several sheets can take a few seconds.</p>
        </div>
      )}

      {reviewing && (
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[260px_1fr]">
          <aside className="border-b border-line bg-canvas/60 p-4 md:overflow-auto md:border-r md:border-b-0">
            <h3 className="mb-2 px-1 text-[11px] font-medium tracking-wide text-subtle uppercase">Sheets in workbook</h3>
            <div className="space-y-1.5">
              {step.analysis.sheets.map((s) => {
                const active = s.name === sheetName
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => void loadSheet(s.name)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active ? 'border-ink bg-surface shadow-card' : 'border-transparent hover:border-line hover:bg-surface',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sheet className="size-4 text-muted" />
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      {active && <Check className="ml-auto size-4" />}
                    </div>
                    <div className="mt-1 text-xs text-muted tabular">
                      {s.rowCount.toLocaleString('en-GB')} rows · {s.columnCount} columns
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.name === step.analysis.recommended && <Badge tone="brand">Recommended</Badge>}
                      {s.imageColumn ? (
                        <Badge>
                          <ImageIcon className="size-3" /> Images
                        </Badge>
                      ) : (
                        <Badge>No images</Badge>
                      )}
                      {s.hidden && (
                        <Badge>
                          <EyeOff className="size-3" /> Hidden
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-h-0 overflow-auto">
            {loadingDraft || !draft ? (
              <div className="grid h-60 place-items-center">
                <Spinner className="size-5 text-muted" />
              </div>
            ) : (
              <div className="space-y-8 p-6">
                {error && <p className="text-sm text-danger">{error}</p>}
                <section className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Line list name</span>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SS27 International" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Brand</span>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} list="known-brands" placeholder="e.g. Brand name" />
                    <datalist id="known-brands">
                      {knownBrands(lineLists).map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </datalist>
                  </label>
                </section>

                <QualityList issues={quality} />

                <FieldMapping draft={draft} roles={roles} onChange={setRoles} />

                <PricingPreview draft={draft} roles={roles} />

                <section>
                  <SectionTitle title="Columns detected" hint="Every column becomes a filter, a sort option and a detail field." />
                  <div className="flex flex-wrap gap-1.5">
                    {draft.columns.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs">
                        {c.header}
                        <span className="text-subtle">{c.kind}</span>
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function QualityList({ issues }: { issues: ReturnType<typeof recheckQuality> }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
        <Check className="size-4 text-ok" /> No data-quality issues found.
      </div>
    )
  }
  return (
    <section>
      <SectionTitle title="Data quality" hint="Nothing here blocks the import; it tells you what to expect." />
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {issues.map((q, i) => (
          <li key={i} className={cn('flex gap-3 px-4 py-2.5 text-sm', q.level === 'warning' ? 'bg-warn-soft/50' : 'bg-surface')}>
            {q.level === 'warning' ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" /> : <Info className="mt-0.5 size-4 shrink-0 text-subtle" />}
            <span>{q.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FieldMapping({ draft, roles, onChange }: { draft: LineListDraft; roles: RoleMap; onChange: (r: RoleMap) => void }) {
  const sample = (columnId?: string) => {
    if (!columnId) return ''
    const c = draft.columns.findIndex((col) => col.id === columnId)
    if (c < 0) return ''
    const row = draft.rows.find((r) => r[c] !== null && r[c] !== '')
    return row ? formatCell(draft.columns[c], row[c]) : ''
  }
  return (
    <section>
      <SectionTitle title="Field mapping" hint="Which column feeds each part of the product card. Detected automatically — change any of them." />
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {FIELD_ROLES.map((role) => {
          const allowed = ROLE_KINDS[role]
          const options = draft.columns.filter((c) => !allowed || allowed.includes(c.kind))
          return (
            <label key={role} className="block">
              <span className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">{ROLE_LABELS[role]}</span>
                <span className="truncate text-subtle" title={sample(roles[role])}>
                  {sample(roles[role])}
                </span>
              </span>
              <Select value={roles[role] ?? ''} onChange={(e) => onChange({ ...roles, [role]: e.target.value || undefined })}>
                <option value="">— Not mapped —</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.header}
                  </option>
                ))}
              </Select>
              {ROLE_HINTS[role] && <span className="mt-1 block text-[11px] text-subtle">{ROLE_HINTS[role]}</span>}
            </label>
          )
        })}
      </div>
    </section>
  )
}

function PricingPreview({ draft, roles }: { draft: LineListDraft; roles: RoleMap }) {
  const settings = useSettings((s) => s.settings)
  const openSettings = useUi((s) => s.openSettings)
  const preview = useMemo(() => {
    if (!roles.price || settings.pricing.fields.length === 0) return null
    const index = buildCatalogIndex(finalizeLineList(draft, { name: 'preview', brand: null, fileName: '', roles }), settings)
    const full = index.roles.fullPrice ? index.byId.get(index.roles.fullPrice) : undefined
    const psf = index.byId.get(roles.price)
    if (!full || !psf) return null
    const r = full.values.findIndex((v) => typeof v === 'number')
    const priced = full.values.filter((v) => typeof v === 'number').length
    if (r < 0) return { psf: null, full: null, header: full.def.header, priced, total: index.rowCount }
    return { psf: formatCell(psf.def, psf.values[r]), full: formatCell(full.def, full.values[r]), header: full.def.header, priced, total: index.rowCount }
  }, [draft, roles, settings])

  if (!roles.price) return null
  if (settings.pricing.fields.length === 0) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
        <Info className="size-4 text-subtle" />
        <span className="flex-1">No pricing file is loaded on this device, so only PSF will be shown. Full prices appear once it's loaded.</span>
        <Button size="sm" onClick={() => openSettings('pricing')}>
          Load pricing file
        </Button>
      </section>
    )
  }
  if (!preview) return null
  return (
    <section>
      <SectionTitle title="Pricing check" hint="First product, using the pricing file loaded on this device." />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm tabular">
        {preview.full === null ? (
          <span className="text-warn">The pricing file could not price any product — check that the price and VAT columns are mapped.</span>
        ) : (
          <>
            <span>
              PSF <b>{preview.psf}</b>
            </span>
            <span className="text-subtle">→</span>
            <span>
              {preview.header} <b>{preview.full}</b>
            </span>
            <span className="ml-auto text-xs text-muted">
              {preview.priced.toLocaleString('en-GB')} of {preview.total.toLocaleString('en-GB')} products priced
            </span>
          </>
        )}
      </div>
    </section>
  )
}
