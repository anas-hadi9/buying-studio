import { FileLock2, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlays'
import { Input } from '@/components/ui/primitives'
import { collectCodes, DEFAULT_MATERIAL_NAMES } from '@/domain/materials'
import { EMPTY_PRICING, parsePricingFile, priceFieldHeader } from '@/domain/pricing'
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
        {(['pricing', 'materials'] as SettingsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium', tab === t ? 'border-ink text-fg' : 'border-transparent text-muted hover:text-fg')}
          >
            {t === 'pricing' ? 'Pricing' : 'Material codes'}
          </button>
        ))}
      </div>
      {open && (tab === 'pricing' ? <PricingFileForm onDone={() => onOpenChange(false)} /> : <MaterialsForm onDone={() => onOpenChange(false)} />)}
    </Dialog>
  )
}

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
