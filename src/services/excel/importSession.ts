import type { LineListDraft, WorkbookAnalysis } from '@/domain/import/analyze'
import type { WorkerRequest, WorkerResponse } from './protocol'

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type RequestBody = DistributiveOmit<WorkerRequest, 'id'>

/**
 * One import = one worker. The worker keeps the parsed workbook so the user can
 * try different sheets; dispose() frees it once the import finishes.
 */
export class ImportSession {
  private worker = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' })
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor() {
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      this.pending.delete(e.data.id)
      if (e.data.type === 'error') p.reject(new Error(e.data.message))
      else p.resolve(e.data)
    })
    this.worker.addEventListener('error', (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'The Excel reader stopped unexpectedly.'))
      this.pending.clear()
    })
  }

  private send(body: RequestBody, transfer: Transferable[] = []): Promise<WorkerResponse> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ ...body, id } as WorkerRequest, transfer)
    })
  }

  async analyze(file: File): Promise<WorkbookAnalysis> {
    const buffer = await file.arrayBuffer()
    const res = await this.send({ type: 'analyze', buffer }, [buffer])
    if (res.type !== 'analysis') throw new Error('Unexpected response from the Excel reader.')
    return res.analysis
  }

  async draft(sheetName: string): Promise<LineListDraft> {
    const res = await this.send({ type: 'draft', sheetName })
    if (res.type !== 'draft') throw new Error('Unexpected response from the Excel reader.')
    return res.draft
  }

  dispose() {
    this.worker.terminate()
    for (const p of this.pending.values()) p.reject(new Error('Import cancelled.'))
    this.pending.clear()
  }
}
