/**
 * Minimal .xlsx writer for exports: one or more sheets with a bold, frozen
 * header row, auto-filter, column widths, number/date formats and clickable
 * links. Text is written as inline strings, so nothing a cell contains can
 * turn into a formula.
 */
import { strToU8, zipSync } from 'fflate'
import type { ExportTable } from '@/domain/catalog/exportTable'

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAX_TEXT = 32_767

// Characters XML 1.0 can't carry; Excel files containing them don't open.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function escapeXml(text: string): string {
  return text.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 0 → "A", 26 → "AA". */
export function columnLetter(index: number): string {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Excel sheet names: ≤ 31 characters, none of []:*?/\, unique ignoring case. */
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((raw) => {
    const base = raw.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '') || 'Sheet'
    let name = base.slice(0, 31)
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - ` (${i})`.length)} (${i})`
    used.add(name.toLowerCase())
    return name
  })
}

/** Absolute http(s)/mailto URL, normalised for Excel, or null. */
function linkTarget(text: string): string | null {
  try {
    const url = new URL(text.trim())
    return /^(https?|mailto):$/.test(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function width(table: ExportTable, c: number): number {
  let w = table.columns[c].header.length
  const sample = Math.min(table.rows.length, 300)
  for (let r = 0; r < sample; r++) {
    const v = table.rows[r][c]
    if (v !== null) w = Math.max(w, typeof v === 'number' ? 10 : String(v).length)
  }
  return Math.min(Math.max(w + 2, 8), table.columns[c].link ? 40 : 60)
}

// Fixed cell styles; number formats are appended after these.
const STYLE_HEADER = 1
const STYLE_LINK = 2
const FIXED_STYLES = 3

function sheetXml(table: ExportTable, styleOf: (format: string | undefined) => number, selected: boolean) {
  const cols = table.columns
  const lastCol = columnLetter(Math.max(cols.length - 1, 0))
  const lastRow = table.rows.length + 1
  const ref = `A1:${lastCol}${lastRow}`
  const styles = cols.map((c) => (c.link ? STYLE_LINK : styleOf(c.format)))
  const links: { ref: string; target: string }[] = []

  const out: string[] = [
    XML,
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">`,
    `<dimension ref="${ref}"/>`,
    `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>`,
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>',
    '</sheetView></sheetViews>',
    '<sheetFormatPr defaultRowHeight="15"/>',
    '<cols>',
    ...cols.map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(table, c)}" customWidth="1"/>`),
    '</cols><sheetData>',
    '<row r="1">',
    ...cols.map((c, i) => `<c r="${columnLetter(i)}1" t="inlineStr" s="${STYLE_HEADER}"><is><t>${escapeXml(c.header)}</t></is></c>`),
    '</row>',
  ]
  const letters = cols.map((_, i) => columnLetter(i))
  table.rows.forEach((row, ri) => {
    const r = ri + 2
    out.push(`<row r="${r}">`)
    for (let c = 0; c < cols.length; c++) {
      const v = row[c]
      const at = `${letters[c]}${r}`
      if (v === null || v === undefined || v === '') continue
      if (typeof v === 'number') {
        if (Number.isFinite(v)) out.push(`<c r="${at}" s="${styles[c]}"><v>${v}</v></c>`)
      } else if (typeof v === 'boolean') {
        out.push(`<c r="${at}" t="b"><v>${v ? 1 : 0}</v></c>`)
      } else {
        const target = cols[c].link ? linkTarget(v) : null
        if (target) links.push({ ref: at, target })
        const text = v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v
        out.push(`<c r="${at}" t="inlineStr" s="${target ? STYLE_LINK : 0}"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`)
      }
    }
    out.push('</row>')
  })
  out.push('</sheetData>')
  if (cols.length > 0) out.push(`<autoFilter ref="${ref}"/>`)
  if (links.length > 0) {
    out.push('<hyperlinks>', ...links.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rId${i + 1}"/>`), '</hyperlinks>')
  }
  out.push('<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>')

  const rels =
    links.length === 0
      ? null
      : [
          XML,
          `<Relationships xmlns="${NS_PKG}">`,
          ...links.map((l, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/hyperlink" Target="${escapeXml(l.target)}" TargetMode="External"/>`),
          '</Relationships>',
        ].join('')
  return { xml: out.join(''), rels, ref }
}

const font = (extra = '') => `<font>${extra}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`

function stylesXml(formats: string[]) {
  return [
    XML,
    `<styleSheet xmlns="${NS_MAIN}">`,
    formats.length
      ? `<numFmts count="${formats.length}">${formats.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(f)}"/>`).join('')}</numFmts>`
      : '',
    `<fonts count="3">${font()}${font('<b/>')}${font('<u/><color rgb="FF0563C1"/>')}</fonts>`,
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2EFEA"/><bgColor indexed="64"/></patternFill></fill></fills>',
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9C3B8"/></bottom><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    `<cellXfs count="${FIXED_STYLES + formats.length}">`,
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    ...formats.map((_, i) => `<xf numFmtId="${164 + i}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`),
    '</cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    '</styleSheet>',
  ].join('')
}

/** Builds an .xlsx workbook with one sheet per table. */
export function writeXlsx(tables: ExportTable[]): Uint8Array {
  if (tables.length === 0) throw new Error('Nothing to export.')
  const formats: string[] = []
  const styleOf = (format: string | undefined) => {
    if (!format) return 0
    let i = formats.indexOf(format)
    if (i < 0) i = formats.push(format) - 1
    return FIXED_STYLES + i
  }
  const names = sheetNames(tables.map((t) => t.name))
  const files: Record<string, Uint8Array> = {}
  const definedNames: string[] = []
  tables.forEach((table, i) => {
    const sheet = sheetXml(table, styleOf, i === 0)
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheet.xml)
    if (sheet.rels) files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(sheet.rels)
    if (table.columns.length > 0) {
      const [from, to] = sheet.ref.split(':').map((a) => a.replace(/([A-Z]+)(\d+)/, '$$$1$$$2'))
      definedNames.push(
        `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapeXml(names[i].replace(/'/g, "''"))}'!${from}:${to}</definedName>`,
      )
    }
  })

  files['[Content_Types].xml'] = strToU8(
    [
      XML,
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      ...tables.map(
        (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      ),
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
      '</Types>',
    ].join(''),
  )
  files['_rels/.rels'] = strToU8(
    [
      XML,
      `<Relationships xmlns="${NS_PKG}">`,
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>`,
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
      `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>`,
      '</Relationships>',
    ].join(''),
  )
  files['docProps/core.xml'] = strToU8(
    [
      XML,
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '<dc:creator>Buying Studio</dc:creator>',
      `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>`,
      '</cp:coreProperties>',
    ].join(''),
  )
  files['docProps/app.xml'] = strToU8(
    `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Buying Studio</Application></Properties>`,
  )
  files['xl/workbook.xml'] = strToU8(
    [
      XML,
      `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}">`,
      '<bookViews><workbookView/></bookViews><sheets>',
      ...names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`),
      '</sheets>',
      definedNames.length ? `<definedNames>${definedNames.join('')}</definedNames>` : '',
      '</workbook>',
    ].join(''),
  )
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    [
      XML,
      `<Relationships xmlns="${NS_PKG}">`,
      ...tables.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`),
      `<Relationship Id="rId${tables.length + 1}" Type="${REL}/styles" Target="styles.xml"/>`,
      '</Relationships>',
    ].join(''),
  )
  // Styles last: number formats are collected while the sheets are written.
  files['xl/styles.xml'] = strToU8(stylesXml(formats))
  return zipSync(files, { level: 6 })
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
