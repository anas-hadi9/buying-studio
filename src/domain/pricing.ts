/**
 * Calculated price fields.
 *
 * The app ships with no pricing logic. Formulas and currencies come from a
 * private pricing file that the buying team distributes internally; each buyer
 * loads it once (Settings → Pricing) and it is stored on their device only.
 * The first field in the file is the headline price shown on cards and used
 * for totals.
 */
import { formulaError } from './formula'

export const PRICING_FILE_FORMAT = 'buying-studio-pricing'

export interface PriceField {
  /** Display name, e.g. "Full Price". */
  name: string
  /** Currency or unit label, e.g. "EUR". */
  currency: string | null
  /** Decimals to display (the formula does its own rounding). */
  decimals: number
  /** Formula in the language described in formula.ts. */
  formula: string
}

export interface PricingSettings {
  fields: PriceField[]
  /** Currency label of the mapped retail price (PSF) column, e.g. "EUR". */
  priceColumnCurrency: string | null
  /** When the pricing file was loaded (ISO). */
  loadedAt: string | null
  /** File name it was loaded from. */
  source: string | null
}

export const EMPTY_PRICING: PricingSettings = { fields: [], priceColumnCurrency: null, loadedAt: null, source: null }

/**
 * Rounds like Excel's ROUND: half away from zero, and tolerant of binary
 * floating-point noise (e.g. 1.005 → 1.01, which Math.round gets wrong).
 */
export function excelRound(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value
  const sign = value < 0 ? -1 : 1
  // Excel works to 15 significant digits; trimming first removes FP noise.
  const abs = Math.abs(Number(value.toPrecision(15)))
  const text = String(abs)
  if (text.includes('e')) {
    const factor = 10 ** digits
    return (sign * Math.round(abs * factor)) / factor
  }
  const shifted = Number(`${text}e${digits}`)
  return sign * Number(`${Math.round(shifted)}e-${digits}`)
}

/** VAT may be stored as a fraction (0.2) or a percentage (20). */
export function normalizeVat(vat: number): number {
  return vat > 1 ? vat / 100 : vat
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Validates the contents of a pricing file. Throws with a message a buyer can
 * act on; never echoes formulas back.
 */
export function parsePricingFile(text: string, fileName: string): PricingSettings {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid pricing file (it is not JSON).')
  }
  if (!isRecord(data) || data.format !== PRICING_FILE_FORMAT) {
    throw new Error('This is not a Buying Studio pricing file.')
  }
  if (!Array.isArray(data.fields) || data.fields.length === 0) {
    throw new Error('The pricing file has no price fields.')
  }
  const fields = data.fields.map((f, i): PriceField => {
    if (!isRecord(f) || typeof f.name !== 'string' || !f.name.trim() || typeof f.formula !== 'string') {
      throw new Error(`Price field ${i + 1} needs a "name" and a "formula".`)
    }
    const err = formulaError(f.formula)
    if (err) throw new Error(`The formula for “${f.name}” is invalid: ${err}.`)
    const decimals = typeof f.decimals === 'number' && f.decimals >= 0 && f.decimals <= 6 ? Math.round(f.decimals) : 2
    return {
      name: f.name.trim(),
      currency: typeof f.currency === 'string' && f.currency.trim() ? f.currency.trim() : null,
      decimals,
      formula: f.formula,
    }
  })
  return {
    fields,
    priceColumnCurrency: typeof data.priceColumnCurrency === 'string' && data.priceColumnCurrency.trim() ? data.priceColumnCurrency.trim() : null,
    loadedAt: new Date().toISOString(),
    source: fileName,
  }
}

export function priceFieldHeader(f: PriceField): string {
  return f.currency ? `${f.name} (${f.currency})` : f.name
}
