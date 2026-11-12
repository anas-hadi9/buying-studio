/** "1 product", "1,405 products". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? word : many}`
}

/** Just the noun, for when the number is styled separately. */
export function noun(n: number, word: string, many = `${word}s`): string {
  return n === 1 ? word : many
}
