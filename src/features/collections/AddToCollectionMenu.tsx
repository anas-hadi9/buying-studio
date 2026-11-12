import { FolderPlus, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/overlays'
import { Input } from '@/components/ui/primitives'
import { collectionKeys } from '@/domain/collections'
import { useWorkspace } from '@/stores/workspace'

export function announceAdded(added: number, requested: number, name: string) {
  if (added === 0) toast(`Already in “${name}”`)
  else {
    const skipped = requested - added
    toast.success(`Added ${added} product${added === 1 ? '' : 's'} to “${name}”${skipped > 0 ? ` (${skipped} already there)` : ''}`)
  }
}

/** Menu listing the line list's collections, plus "New collection…". */
export function AddToCollectionMenu({ keys, trigger, align = 'end' }: { keys: string[]; trigger: ReactNode; align?: 'start' | 'end' }) {
  const collections = useWorkspace((s) => s.collections)
  const addToCollection = useWorkspace((s) => s.addToCollection)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <Menu>
        <MenuTrigger asChild>{trigger}</MenuTrigger>
        <MenuContent align={align} onClick={(e) => e.stopPropagation()}>
          <MenuLabel>Add {keys.length === 1 ? 'product' : `${keys.length} products`} to</MenuLabel>
          {collections.map((c) => {
            const has = collectionKeys(c)
            const all = keys.every((k) => has.has(k))
            return (
              <MenuItem
                key={c.id}
                disabled={all}
                onSelect={async () => announceAdded(await addToCollection(c.id, keys), keys.length, c.name)}
              >
                <FolderPlus />
                <span className="truncate">{c.name}</span>
                {all && <span className="ml-auto text-xs text-subtle">added</span>}
              </MenuItem>
            )
          })}
          {collections.length > 0 && <MenuSeparator />}
          <MenuItem onSelect={() => setCreating(true)}>
            <Plus /> New collection…
          </MenuItem>
        </MenuContent>
      </Menu>
      <NewCollectionDialog open={creating} onOpenChange={setCreating} keys={keys} />
    </>
  )
}

export function NewCollectionDialog({ open, onOpenChange, keys = [] }: { open: boolean; onOpenChange: (o: boolean) => void; keys?: string[] }) {
  const createCollection = useWorkspace((s) => s.createCollection)
  const count = useWorkspace((s) => s.collections.length)
  const [name, setName] = useState('')
  const submit = async () => {
    const c = await createCollection(name || `Collection ${count + 1}`, keys)
    toast.success(keys.length ? `Created “${c.name}” with ${keys.length} product${keys.length === 1 ? '' : 's'}` : `Created “${c.name}”`)
    setName('')
    onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New collection"
      description={keys.length ? `${keys.length} product${keys.length === 1 ? '' : 's'} will be added.` : 'Drag products onto it from the catalogue.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Create collection
          </Button>
        </>
      }
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`Collection ${count + 1}`} aria-label="Collection name" />
      </form>
    </Dialog>
  )
}
