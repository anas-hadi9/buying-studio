import { toast } from 'sonner'
import { collectionsTables, productTable, type ExportTable } from '@/domain/catalog/exportTable'
import { safeFileBase } from '@/domain/text'
import type { Collection } from '@/domain/types'
import { downloadBlob } from '@/lib/download'
import { plural } from '@/lib/plural'
import { useWorkspace } from '@/stores/workspace'

/** Excel exports for the open line list: product lists and collections. */
export function useExcelExport() {
  const lineList = useWorkspace((s) => s.lineList)
  const index = useWorkspace((s) => s.index)
  const collections = useWorkspace((s) => s.collections)

  const save = async (tables: ExportTable[], label: string, message: string) => {
    try {
      // The writer (and its zip library) loads only when someone exports.
      const { writeXlsx, XLSX_MIME } = await import('@/services/xlsx')
      const bytes = writeXlsx(tables)
      const name = safeFileBase([lineList?.name, label]) || 'export'
      downloadBlob(`${name}.xlsx`, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: XLSX_MIME }))
      toast.success(message)
    } catch (e) {
      toast.error(`Couldn’t create the Excel file: ${(e as Error).message}`)
    }
  }

  /** Exports products (row numbers, in the order given) with every column. */
  const exportProducts = async (rows: number[], label: string) => {
    if (!index || rows.length === 0) return
    await save([productTable(index, 'Products', rows)], label, `Exported ${plural(rows.length, 'product')} to Excel`)
  }

  /** Exports collections with a summary sheet and a products sheet. */
  const exportCollections = async (which: Collection[] = collections) => {
    if (!index || which.length === 0) return
    const result = collectionsTables(index, which)
    const label = which.length === 1 ? which[0].name : 'collections'
    const note = result.missing > 0 ? ` ${plural(result.missing, 'product')} not in this line list were left out.` : ''
    await save(result.tables, label, `Exported ${plural(which.length, 'collection')} to Excel.${note}`)
  }

  return { exportProducts, exportCollections, canExportCollections: collections.length > 0 }
}
