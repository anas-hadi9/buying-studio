/// <reference lib="webworker" />
import readExcelFile from 'read-excel-file/web-worker'
import { analyzeWorkbook, buildDraft } from '@/domain/import/analyze'
import type { RawSheet } from '@/domain/import/sheet'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { readHiddenSheets } from './workbookMeta'

declare const self: DedicatedWorkerGlobalScope

// Parsed sheets stay in the worker so switching sheet in the wizard is instant
// and large sheets never have to cross to the main thread unless chosen.
let sheets: RawSheet[] = []

function reply(message: WorkerResponse) {
  // Dedicated workers post to their owner; there is no target origin.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  self.postMessage(message)
}

function describeError(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code === 'XLS_FILE_NOT_SUPPORTED') return 'Old .xls files are not supported. Save the file as .xlsx in Excel and try again.'
  if (code === 'INVALID_ZIP' || code === 'FILE_NOT_SUPPORTED') return 'This file is not a valid .xlsx workbook.'
  return err instanceof Error ? err.message : 'The file could not be read.'
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  try {
    if (msg.type === 'analyze') {
      const hidden = readHiddenSheets(msg.buffer)
      const parsed = await readExcelFile(msg.buffer)
      sheets = parsed.map((s) => ({
        name: s.sheet,
        hidden: hidden.has(s.sheet),
        data: s.data as RawSheet['data'],
      }))
      reply({ id: msg.id, type: 'analysis', analysis: analyzeWorkbook(sheets) })
    } else {
      const sheet = sheets.find((s) => s.name === msg.sheetName)
      if (!sheet) throw new Error(`Sheet “${msg.sheetName}” was not found.`)
      reply({ id: msg.id, type: 'draft', draft: buildDraft(sheet) })
    }
  } catch (err) {
    reply({ id: msg.id, type: 'error', message: describeError(err) })
  }
})
