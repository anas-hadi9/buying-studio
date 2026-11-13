import { ExternalLink, FileLock2, Globe, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlays'
import { Input } from '@/components/ui/primitives'
import { collectCodes, DEFAULT_MATERIAL_NAMES } from '@/domain/materials'
import { EMPTY_PRICING, parsePricingFile, priceFieldHeader } from '@/domain/pricing'
import { linkHost, productLink, toLinkTemplate } from '@/domain/productLink'
import { colourCode } from '@/domain/catalog/colourways'
import { cn } from '@/lib/cn'
import { useSettings } from '@/stores/settings'
import { useUi, type SettingsTab } from '@/stores/ui'
import { useWorkspace } from '@/stores/workspace'

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const tab = useUi((s) => s.settingsTab)
  const setTab = useUi((s) => s.setSettingsTab)
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Settings" description="Saved on this device only and applied to every line list." className="h-[min(640px,90dvh)] max-w-2xl">
      <div className="flex gap-1 border-b border-line px-6">
        {(['pricing', 'materials', 'website'] as SettingsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium', tab === t ? 'border-ink text-fg' : 'border-transparent text-muted hover:text-fg')}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {open && tab === 'pricing' && <PricingFileForm onDone={() => onOpenChange(false)} />}
      {open && tab === 'materials' && <MaterialsForm onDone={() => onOpenChange(false)} />}
      {open && tab === 'website' && <WebsiteLinkForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

const TAB_LABELS: Record<SettingsTab, string> = { pricing: 'Pricing', materials: 'Material codes', website: 'Website link' }

const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Pricing comes from a private file distributed by the buying team. The app
 * never displays the formulas: only which fields the file provides.
 */
function PricingFileForm({ onDone }: { onDone: () => void }) {
  const pricing = useSettings((s) => s.settings.pricing)
  const update = useSettings((s) => s.update)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = pricing.fields.length > 0

  const load = async (file: File) => {
    setError(null)
    try {
      const next = parsePricingFile(await file.text(), file.name)
      await update({ pricing: next })
      toast.success(`Pricing loaded — ${next.fields.map(priceFieldHeader).join(', ')}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-5 p-6">
      <p className="text-sm text-muted">
        Prices are calculated from a <b className="text-fg">private pricing file</b> supplied by your buying team. The file is read on this device and stored only
        here; it is never uploaded and its formulas are never shown.
      </p>

      <div className={cn('rounded-xl border p-4', loaded ? 'border-line bg-surface' : 'border-dashed border-line-strong bg-surface-2/40')}>
        {loaded ? (
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ok">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Pricing file loaded</p>
              <p className="mt-0.5 text-xs text-muted">
                {pricing.source}
                {pricing.loadedAt && <> · {dateTime.format(new Date(pricing.loadedAt))}</>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pricing.fields.map((f) => (
                  <span key={f.name} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">
                    {priceFieldHeader(f)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <FileLock2 className="size-5 text-subtle" />
            <span>No pricing file loaded. Products show PSF only.</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => input.current?.click()}>
          <Upload /> {loaded ? 'Load updated file…' : 'Load pricing file…'}
        </Button>
        {loaded && (
          <Button
            variant="ghost"
            onClick={async () => {
              await update({ pricing: EMPTY_PRICING })
              toast('Pricing file removed from this device')
            }}
          >
            <Trash2 /> Remove
          </Button>
        )}
        <Button variant="ghost" className="ml-auto" onClick={onDone}>
          Close
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void load(file)
            e.target.value = ''
          }}
        />
      </div>
      <p className="text-xs text-subtle">When prices change, your team sends an updated file — load it here again.</p>
    </div>
  )
}

function MaterialsForm({ onDone }: { onDone: () => void }) {
  const saved = useSettings((s) => s.settings.materialNames)
  const update = useSettings((s) => s.update)
  const index = useWorkspace((s) => s.index)
  const [names, setNames] = useState<Record<string, string>>(saved)
  const [newCode, setNewCode] = useState('')

  const usage = useMemo(() => {
    const comp = index?.roles.composition ? index.byId.get(index.roles.composition) : undefined
    return comp ? collectCodes(comp.values.map((v) => (typeof v === 'string' ? v : null))) : new Map<string, number>()
  }, [index])

  const codes = useMemo(() => {
    const all = new Set([...usage.keys(), ...Object.keys(names)])
    return [...all].sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0) || a.localeCompare(b))
  }, [usage, names])

  return (
    <div className="flex h-full flex-col">
      <p className="px-6 pt-5 text-sm text-muted">
        Composition codes like <code className="rounded bg-surface-2 px-1">CO</code> are shown by name in Main Material, Material Mix and filters. Codes without a name are
        shown as-is.{index && usage.size > 0 && ' Counts are for the open line list.'}
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-subtle">
              <th className="pb-2 font-medium">Code</th>
              <th className="pb-2 font-medium">Products</th>
              <th className="pb-2 font-medium">Name</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code} className="border-t border-line">
                <td className="py-1.5 pr-4 font-mono text-xs">{code}</td>
                <td className="py-1.5 pr-4 text-xs text-muted tabular">{usage.get(code) ?? '—'}</td>
                <td className="py-1.5">
                  <Input
                    value={names[code] ?? ''}
                    placeholder="Unnamed — shown as code"
                    onChange={(e) => {
                      const next = { ...names }
                      if (e.target.value.trim()) next[code] = e.target.value
                      else delete next[code]
                      setNames(next)
                    }}
                    className={cn('h-8', !names[code] && 'border-warn/40')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const c = newCode.trim().toUpperCase()
            if (c && !(c in names)) setNames({ ...names, [c]: '' })
            setNewCode('')
          }}
        >
          <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Add code…" className="h-8 w-32" />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </div>
      <div className="flex items-center justify-between border-t border-line px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => setNames(DEFAULT_MATERIAL_NAMES)}>
          <RotateCcw /> Reset to defaults
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const cleaned = Object.fromEntries(Object.entries(names).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]))
              await update({ materialNames: cleaned })
              toast.success('Material names updated')
              onDone()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Links products to their page on the brand website. The buyer pastes the
 * address of any product page or search; the ref no in it becomes a
 * placeholder, so the app never needs to know how the website is built.
 */
function WebsiteLinkForm({ onDone }: { onDone: () => void }) {
  const template = useSettings((s) => s.settings.productLink)
  const update = useSettings((s) => s.update)
  const index = useWorkspace((s) => s.index)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const styleCol = index?.roles.style ? index.byId.get(index.roles.style) : undefined
  const parts = (r: number) => ({
    key: index!.keys[r],
    style: styleCol?.values[r] != null ? String(styleCol.values[r]) : null,
    code: colourCode(index!, r),
  })
  const sample = index && index.rowCount > 0 ? parts(0) : null
  const sampleLink = sample ? productLink(template, sample) : null

  const save = async () => {
    setError(null)
    const examples = index ? Array.from({ length: index.rowCount }, (_, r) => parts(r)) : []
    const next = toLinkTemplate(draft, examples)
    if (!next) {
      setError(
        index
          ? 'No ref no from this line list was found in that link. Search the website for a ref no such as ' + (sample?.key ?? '') + ', then copy the address.'
          : 'Open a line list first, or write {key} where the ref no goes.',
      )
      return
    }
    await update({ productLink: next })
    setDraft('')
    toast.success(`Products now link to ${linkHost(next)}`)
  }

  return (
    <div className="space-y-5 p-6">
      <p className="text-sm text-muted">
        Open any product on the brand website from its detail view, to see its real colour and photos. On the website, search for a ref no
        {sample && (
          <>
            {' '}
            (for example <b className="text-fg tabular">{sample.key}</b>)
          </>
        )}
        , copy the address from the browser and paste it here. Each product then gets its own link.
      </p>

      {template && (
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ok">
              <Globe className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Products link to {linkHost(template)}</p>
              <p className="mt-0.5 truncate text-xs text-muted" title={template}>
                {template}
              </p>
              {sampleLink && (
                <a href={sampleLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  <ExternalLink className="size-3" /> Try it with {sample?.key}
                </a>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void update({ productLink: null })}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-2"
      >
        <label htmlFor="product-link" className="text-sm font-medium">
          {template ? 'Replace with another link' : 'Website link'}
        </label>
        <div className="flex gap-2">
          <Input
            id="product-link"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://www.brand-website.com/search?q=2200001-123"
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Save
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <p className="text-[11px] text-subtle">Saved on this device. Advanced: write {'{key}'}, {'{style}'} or {'{code}'} (colour code) where they belong.</p>
      </form>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onDone}>
          Close
        </Button>
      </div>
    </div>
  )
}
