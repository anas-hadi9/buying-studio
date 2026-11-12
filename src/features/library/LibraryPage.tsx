import { FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/overlays'
import { Input, Spinner } from '@/components/ui/primitives'
import type { LineListSummary } from '@/domain/types'
import { Dropzone, isExcelFile } from '@/features/import/Dropzone'
import { ImportDialog } from '@/features/import/ImportDialog'
import { ProductImage } from '@/features/product/ProductImage'
import { knownBrands, useLibrary } from '@/stores/library'
import { plural } from '@/lib/plural'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function LibraryPage() {
  const { lineLists, collectionCounts, loaded, load } = useLibrary()
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => void load(), [load])

  const startImport = (file?: File) => {
    setImportFile(file ?? null)
    setImportOpen(true)
  }

  const byBrand = useMemo(() => {
    const groups = new Map<string, LineListSummary[]>()
    for (const l of lineLists) {
      const key = l.brand ?? 'Unassigned brand'
      groups.set(key, [...(groups.get(key) ?? []), l])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [lineLists])

  return (
    <div
      className="h-full overflow-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file && isExcelFile(file)) startImport(file)
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium tracking-[0.18em] text-subtle uppercase">Open-to-buy</p>
            <h1 className="font-display text-5xl leading-none tracking-tight">Line lists</h1>
            <p className="mt-3 max-w-xl text-[15px] text-muted">
              Import a vendor workbook to browse it as a visual catalogue, then filter, group and build your collections.
            </p>
          </div>
          {lineLists.length > 0 && (
            <Button variant="primary" size="lg" onClick={() => startImport()}>
              <Plus /> Import line list
            </Button>
          )}
        </div>

        {!loaded ? (
          <div className="grid h-60 place-items-center">
            <Spinner className="text-muted" />
          </div>
        ) : lineLists.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <Dropzone large onFile={startImport} />
            <p className="mt-4 text-center text-xs text-subtle">
              Files are processed in your browser and saved on this device only.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {byBrand.map(([brand, items]) => (
              <section key={brand}>
                <div className="mb-4 flex items-baseline gap-3 border-b border-line pb-2">
                  <h2 className="text-sm font-semibold tracking-[0.12em] uppercase">{brand}</h2>
                  <span className="text-xs text-subtle">
                    {plural(items.length, 'line list')}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                  {items.map((l) => (
                    <LineListTile key={l.id} lineList={l} collections={collectionCounts[l.id] ?? 0} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} initialFile={importFile} />
    </div>
  )
}

function LineListTile({ lineList, collections }: { lineList: LineListSummary; collections: number }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const covers = [...lineList.coverImages, null, null, null, null].slice(0, 4)

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-card">
      <Link to={`/l/${lineList.id}`} className="block">
        <div className="grid aspect-[16/10] grid-cols-4 gap-px bg-line">
          {covers.map((src, i) => (
            <ProductImage key={i} src={src} alt="" compact className="h-full" />
          ))}
        </div>
        <div className="p-4">
          <h3 className="truncate text-[15px] font-semibold">{lineList.name}</h3>
          <p className="mt-1 text-sm text-muted tabular">
            {lineList.productCount.toLocaleString('en-GB')} products
            {collections > 0 && (
              <>
                {' · '}
                {collections} collection{collections === 1 ? '' : 's'}
              </>
            )}
          </p>
          <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-subtle">
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate">
              {lineList.sheetName} · {lineList.fileName}
            </span>
          </p>
          <p className="mt-1 text-xs text-subtle">Imported {dateFormat.format(new Date(lineList.importedAt))}</p>
        </div>
      </Link>
      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="icon-sm" aria-label="Line list actions" className="bg-surface/90 shadow-sm backdrop-blur">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Rename
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <RenameDialog lineList={lineList} open={editing} onOpenChange={setEditing} />
      <DeleteDialog lineList={lineList} collections={collections} open={confirmDelete} onOpenChange={setConfirmDelete} />
    </article>
  )
}

function RenameDialog({ lineList, open, onOpenChange }: { lineList: LineListSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { rename, lineLists } = useLibrary()
  const [name, setName] = useState(lineList.name)
  const [brand, setBrand] = useState(lineList.brand ?? '')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename line list"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await rename(lineList.id, name.trim() || lineList.name, brand.trim() || null)
              onOpenChange(false)
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Brand</span>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} list="rename-brands" />
          <datalist id="rename-brands">
            {knownBrands(lineLists).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </datalist>
        </label>
      </div>
    </Dialog>
  )
}

function DeleteDialog({
  lineList,
  collections,
  open,
  onOpenChange,
}: {
  lineList: LineListSummary
  collections: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const remove = useLibrary((s) => s.remove)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete “${lineList.name}”?`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await remove(lineList.id)
              onOpenChange(false)
              toast(`Deleted ${lineList.name}`)
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className="p-6 text-sm text-muted">
        This removes the imported products{collections > 0 ? `, ${collections} collection${collections === 1 ? '' : 's'}` : ''} and the saved
        selection from this device. The original Excel file is not affected.
      </p>
    </Dialog>
  )
}
