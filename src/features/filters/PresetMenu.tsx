import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/overlays'
import { Input, Tooltip } from '@/components/ui/primitives'
import { useWorkspace } from '@/stores/workspace'

/** Saved filter + search + sort + grouping combinations, reusable across line lists. */
export function PresetMenu() {
  const presets = useWorkspace((s) => s.presets)
  const applyPreset = useWorkspace((s) => s.applyPreset)
  const deletePreset = useWorkspace((s) => s.deletePreset)
  const savePreset = useWorkspace((s) => s.savePreset)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const save = async () => {
    if (!name.trim()) return
    const p = await savePreset(name)
    if (p) toast.success(`Saved preset “${p.name}”`)
    setName('')
    setSaving(false)
  }

  return (
    <>
      <Menu>
        <Tooltip content="Filter presets">
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Filter presets">
              <Bookmark />
            </Button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent className="w-64">
          <MenuItem onSelect={() => setSaving(true)}>
            <BookmarkPlus /> Save current view…
          </MenuItem>
          {presets.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Presets</MenuLabel>
              {presets.map((p) => (
                <MenuItem
                  key={p.id}
                  onSelect={() => {
                    const missing = applyPreset(p)
                    if (missing.length) toast(`Applied “${p.name}”. Not in this file: ${missing.join(', ')}`)
                    else toast(`Applied “${p.name}”`)
                  }}
                  className="group"
                >
                  <Bookmark />
                  <span className="flex-1 truncate">{p.name}</span>
                  <button
                    type="button"
                    aria-label={`Delete preset ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      void deletePreset(p.id)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="rounded p-0.5 text-subtle opacity-0 group-data-[highlighted]:opacity-100 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </MenuItem>
              ))}
            </>
          )}
        </MenuContent>
      </Menu>
      <Dialog
        open={saving}
        onOpenChange={setSaving}
        title="Save filter preset"
        description="Saves the current filters, search, sort and grouping. Presets work on any line list with the same column headers."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              Save preset
            </Button>
          </>
        }
      >
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Women linen, SS27" aria-label="Preset name" />
        </form>
      </Dialog>
    </>
  )
}
