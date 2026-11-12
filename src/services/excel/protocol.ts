import type { LineListDraft, WorkbookAnalysis } from '@/domain/import/analyze'

export type WorkerRequest =
  | { id: number; type: 'analyze'; buffer: ArrayBuffer }
  | { id: number; type: 'draft'; sheetName: string }

export type WorkerResponse =
  | { id: number; type: 'analysis'; analysis: WorkbookAnalysis }
  | { id: number; type: 'draft'; draft: LineListDraft }
  | { id: number; type: 'error'; message: string }
