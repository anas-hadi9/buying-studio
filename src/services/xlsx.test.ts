import { strFromU8, unzipSync } from 'fflate'
import readExcelFile from 'read-excel-file/universal'
import { describe, expect, it } from 'vitest'
import type { ExportTable } from '@/domain/catalog/exportTable'
import { columnLetter, escapeXml, sheetNames, writeXlsx } from './xlsx'

const table: ExportTable = {
  name: 'Products',
  columns: [{ header: 'Item No' }, { header: 'Price', format: '#,##0 "JOD"' }, { header: 'Photo', link: true }, { header: 'Ships', format: 'd mmm yyyy' }, { header: 'Active' }],
  rows: [
    ['1001-052', 90, 'https://img.example/1001 052.jpg', 46388, true],
    ['=HYPERLINK("x")', 1234.5, 'not a link', null, false],
    ['Şık & <bold> \u0001', null, null, null, null],
  ],
}

const toArrayBuffer = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer

describe('writeXlsx', () => {
  it('round-trips values through an Excel reader', async () => {
    const bytes = writeXlsx([table, { name: 'Summary', columns: [{ header: 'A' }], rows: [] }])
    const sheets = await readExcelFile(toArrayBuffer(bytes))
    expect(sheets.map((s) => s.sheet)).toEqual(['Products', 'Summary'])
    const data = sheets[0].data
    expect(data[0]).toEqual(['Item No', 'Price', 'Photo', 'Ships', 'Active'])
    expect(data[1].slice(0, 3)).toEqual(['1001-052', 90, 'https://img.example/1001 052.jpg'])
    expect(data[1][3]).toEqual(new Date('2027-01-01T00:00:00.000Z'))
    expect(data[1][4]).toBe(true)
    // Text that looks like a formula stays text.
    expect(data[2].slice(0, 3)).toEqual(['=HYPERLINK("x")', 1234.5, 'not a link'])
    // The control character is dropped (the reader also trims the trailing space).
    expect(data[3][0]).toBe('Şık & <bold>')
  })

  it('freezes and filters the header row and makes links clickable', () => {
    const files = unzipSync(writeXlsx([table]))
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<autoFilter ref="A1:E4"/>')
    expect(sheet).toContain('<hyperlink ref="C2" r:id="rId1"/>')
    expect(sheet).not.toContain('ref="C3"')
    expect(sheet).not.toContain('<f>')
    const rels = strFromU8(files['xl/worksheets/_rels/sheet1.xml.rels'])
    expect(rels).toContain('Target="https://img.example/1001%20052.jpg"')
    const workbook = strFromU8(files['xl/workbook.xml'])
    expect(workbook).toContain(`'Products'!$A$1:$E$4`)
    const styles = strFromU8(files['xl/styles.xml'])
    expect(styles).toContain('formatCode="#,##0 &quot;JOD&quot;"')
    expect(styles).toContain('formatCode="d mmm yyyy"')
  })
})

describe('helpers', () => {
  it('names columns like Excel', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA'])
  })

  it('makes valid, unique sheet names', () => {
    expect(sheetNames(['Men · Eid: Majlis / Suits', 'Summary', 'summary', '', 'A'.repeat(40), 'A'.repeat(40)])).toEqual([
      'Men · Eid Majlis Suits',
      'Summary',
      'summary (2)',
      'Sheet',
      'A'.repeat(31),
      `${'A'.repeat(27)} (2)`,
    ])
  })

  it('escapes XML and drops characters XML cannot carry', () => {
    expect(escapeXml('a & b < c > "d"\u0000')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;')
  })
})
