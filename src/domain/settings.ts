import { DEFAULT_MATERIAL_NAMES } from './materials'
import { EMPTY_PRICING, type PricingSettings } from './pricing'

/** Organisation-level settings. Device-local today; server-backed later. */
export interface AppSettings {
  /** Calculated price fields, loaded from the private pricing file. */
  pricing: PricingSettings
  /** Composition code → display name (e.g. CO → Cotton). */
  materialNames: Record<string, string>
  /** Link to a product on the brand website, with {key}/{style}/{code} placeholders. */
  productLink: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  pricing: EMPTY_PRICING,
  materialNames: DEFAULT_MATERIAL_NAMES,
  productLink: null,
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
  }
}
