import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/cn'

export const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function isExcelFile(file: File) {
  return /\.xlsx$/i.test(file.name)
}

export function Dropzone({ onFile, className, large }: { onFile: (file: File) => void; className?: string; large?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 text-center transition-colors hover:border-fg/30 hover:bg-surface-2/50',
        large ? 'py-16' : 'py-10',
        over && 'border-brand bg-brand-soft/40',
        className,
      )}
    >
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-muted transition-colors group-hover:text-fg">
        {over ? <FileSpreadsheet className="size-5" /> : <UploadCloud className="size-5" />}
      </span>
      <span className="text-[15px] font-semibold">Drop an OTB / line list workbook</span>
      <span className="mt-1 text-sm text-muted">
        or <span className="font-medium text-fg underline decoration-line-strong underline-offset-4">browse</span> for an .xlsx file
      </span>
      <span className="mt-4 text-xs text-subtle">Any layout works — columns, filters and the image column are detected automatically.</span>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </button>
  )
}
