import { useDeferredValue, useMemo } from 'react'
import type { CatalogIndex } from '@/domain/catalog/buildIndex'
import { runQuery } from '@/domain/catalog/query'
import { groupRows, orderRows, type GroupNode } from '@/domain/catalog/sortGroup'
import type { CellValue, FieldRole } from '@/domain/types'
import type { CatalogRoles } from '@/domain/catalog/buildIndex'
import { useWorkspace } from '@/stores/workspace'
import { formatMoney } from '@/domain/catalog/format'

/**
 * The filtered, sorted and grouped catalogue. Search is deferred so typing
 * stays responsive; everything else is synchronous (a few ms for 10k rows).
 */
export function useCatalogView(index: CatalogIndex) {
  const view = useWorkspace((s) => s.view)
  const selectedOnly = useWorkspace((s) => s.selectedOnly)
  const selection = useWorkspace((s) => s.selection)
  const search = useDeferredValue(view.search)
  const restrictTo = selectedOnly ? selection : null

  const result = useMemo(
    () => runQuery(index, { filters: view.filters, search, restrictTo }),
    [index, view.filters, search, restrictTo],
  )
  const rows = useMemo(() => orderRows(index, result.matches, view.sort), [index, result, view.sort])
  const groups = useMemo(
    () => (view.groupBy.length ? groupRows(index, rows, view.groupBy) : null),
    [index, rows, view.groupBy],
  )
  // Detail navigation follows what's on screen: grouped order when grouped.
  const keys = useMemo(() => {
    if (!groups) return rows.map((r) => index.keys[r])
    const out: string[] = []
    const walk = (nodes: GroupNode[]) => {
      for (const n of nodes) {
        if (n.children) walk(n.children)
        else for (const r of n.rows) out.push(index.keys[r])
      }
    }
    walk(groups)
    return out
  }, [index, rows, groups])
  return { result, rows, groups, keys, stale: search !== view.search }
}

export type ProductRole = FieldRole | keyof Omit<CatalogRoles, FieldRole>

/** Reads the value a role maps to for a row (null when the role is unmapped). */
export function roleValue(index: CatalogIndex, role: ProductRole, row: number): CellValue {
  const id = index.roles[role]
  if (!id) return null
  return index.byId.get(id)?.values[row] ?? null
}

export function roleText(index: CatalogIndex, role: ProductRole, row: number): string {
  const v = roleValue(index, role, row)
  return v === null ? '' : String(v)
}

export function roleNumber(index: CatalogIndex, role: ProductRole, row: number): number | null {
  const v = roleValue(index, role, row)
  return typeof v === 'number' ? v : null
}

/** Formats values of the headline price or the PSF column with their unit and decimals. */
export function moneyFormatter(index: CatalogIndex, role: 'fullPrice' | 'price') {
  const id = index.roles[role]
  const col = id ? index.byId.get(id) : undefined
  const unit = col?.def.format.unit
  const decimals = col?.def.format.style === 'decimal' ? (col.def.format.decimals ?? 2) : 0
  return (value: number | null | undefined) => formatMoney(value ?? null, unit, decimals)
}

export function productTitle(index: CatalogIndex, row: number): string {
  return roleText(index, 'description', row) || roleText(index, 'style', row) || index.keys[row]
}
