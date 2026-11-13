import { DEFAULT_MATERIAL_NAMES } from './materials'
import { DEFAULT_PHOTO_RESIZER } from './photoResizer'
import { EMPTY_PRICING, type PricingSettings } from './pricing'

/** Organisation-level settings. Device-local today; server-backed later. */
export interface AppSettings {
  /** Calculated price fields, loaded from the private pricing file. */
  pricing: PricingSettings
  /** Composition code → display name (e.g. CO → Cotton). */
  materialNames: Record<string, string>
  /** Link to a product on the brand website, with {key}/{style}/{code} placeholders. */
  productLink: string | null
  /** Address of small photo copies, with {url}/{width} placeholders; null = originals only. */
  photoResizer: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  pricing: EMPTY_PRICING,
  materialNames: DEFAULT_MATERIAL_NAMES,
  productLink: null,
  photoResizer: DEFAULT_PHOTO_RESIZER,
}

/**
 * Fills in defaults so older saved settings keep working. Settings saved by
 * earlier builds (fixed-formula pricing) are not carried over: the pricing
 * file has to be loaded again.
 */
export function withDefaults(saved: Partial<AppSettings> | undefined): AppSettings {
  const pricing = saved?.pricing && Array.isArray((saved.pricing as PricingSettings).fields) ? (saved.pricing as PricingSettings) : EMPTY_PRICING
  return {
    pricing: { ...EMPTY_PRICING, ...pricing },
    materialNames: saved?.materialNames ?? DEFAULT_MATERIAL_NAMES,
    productLink: typeof saved?.productLink === 'string' ? saved.productLink : null,
    // Older saved settings have no entry: they get the default (small copies on).
    photoResizer: saved?.photoResizer === undefined ? DEFAULT_PHOTO_RESIZER : saved.photoResizer,
  }
}
