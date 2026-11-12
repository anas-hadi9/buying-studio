import { toast } from 'sonner'
import { collectionsFileName, exportCollections, importCollections, parseCollectionsFile } from '@/domain/collectionsFile'
import type { Collection } from '@/domain/types'
import { downloadText, pickFile } from '@/lib/download'
import { plural } from '@/lib/plural'
import { useWorkspace } from '@/stores/workspace'

/** Export / import of collections files for the open line list. */
export function useCollectionFiles() {
  const lineList = useWorkspace((s) => s.lineList)
  const index = useWorkspace((s) => s.index)
  const collections = useWorkspace((s) => s.collections)
  const addCollections = useWorkspace((s) => s.addCollections)

  const exportFile = (which: Collection[] = collections) => {
    if (!lineList || which.length === 0) return
    const file = exportCollections(lineList, which)
    const name = which.length === 1 ? which[0].name : undefined
    downloadText(collectionsFileName(lineList.name, name), JSON.stringify(file, null, 2))
    toast.success(`Exported ${plural(which.length, 'collection')}`)
  }

  const importFile = async () => {
    if (!lineList || !index) return
    const picked = await pickFile('.json,application/json')
    if (!picked) return
    try {
      const file = parseCollectionsFile(await picked.text())
      const result = importCollections(
        file,
        lineList.id,
        collections.map((c) => c.name),
        (k) => index.keyToRow.has(k),
      )
      await addCollections(result.collections)
      const note = result.missing > 0 ? ` ${plural(result.missing, 'product')} not in this line list.` : ''
      toast.success(`Imported ${plural(result.collections.length, 'collection')} with ${plural(result.products, 'product')}.${note}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return { exportFile, importFile, canExport: collections.length > 0 }
}
