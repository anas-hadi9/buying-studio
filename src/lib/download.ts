/** Saves text as a file in the browser's downloads. */
export function downloadText(fileName: string, text: string, type = 'application/json') {
  downloadBlob(fileName, new Blob([text], { type }))
}

/** Saves a blob (e.g. a generated Excel file) in the browser's downloads. */
export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens a file picker and resolves with the chosen file (or null). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.click()
  })
}
