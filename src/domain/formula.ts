/**
 * A small, safe, Excel-like formula language for calculated price fields.
 *
 * Formulas come from a private pricing file, so the app's code carries no
 * pricing logic of its own. Supported:
 *   numbers            12, 0.5
 *   operators          + - * / ^ and parentheses
 *   functions          ROUND(x, digits), ROUNDUP, ROUNDDOWN, MIN, MAX, ABS, IF(cond, a, b)
 *   comparisons        < <= > >= = <>   (yield 1 or 0, for IF)
 *   column references  PSF and VAT (the mapped price / VAT columns),
 *                      a header without spaces (Psf), or any header in brackets [Vat %]
 * Arguments may be separated by "," or ";" (as in Turkish-locale Excel).
 * Any blank input makes the result blank. No code is ever executed.
 */
import { excelRound } from './pricing'
import { normalizeHeader } from './text'

type Node =
  | { t: 'num'; v: number }
  | { t: 'ref'; name: string; bracketed: boolean }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; fn: string; args: Node[] }

type Token = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'ref'; v: string } | { k: 'op'; v: string }

export class FormulaError extends Error {
  override name = 'FormulaError'
}

const FUNCTIONS: Record<string, { min: number; max: number }> = {
  ROUND: { min: 1, max: 2 },
  ROUNDUP: { min: 1, max: 2 },
  ROUNDDOWN: { min: 1, max: 2 },
  MIN: { min: 1, max: 32 },
  MAX: { min: 1, max: 32 },
  ABS: { min: 1, max: 1 },
  IF: { min: 3, max: 3 },
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?|^\d+\./.exec(src.slice(i))
      if (!m) throw new FormulaError(`Unexpected “${c}” at position ${i + 1}`)
      tokens.push({ k: 'num', v: Number(m[0]) })
      i += m[0].length
    } else if (c === '[') {
      const end = src.indexOf(']', i)
      if (end < 0) throw new FormulaError('Missing “]” after a column name')
      tokens.push({ k: 'ref', v: src.slice(i + 1, end) })
      i = end + 1
    } else if (/[\p{L}_]/u.test(c)) {
      const m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i))!
      tokens.push({ k: 'id', v: m[0] })
      i += m[0].length
    } else {
      const two = src.slice(i, i + 2)
      if (two === '<=' || two === '>=' || two === '<>') {
        tokens.push({ k: 'op', v: two })
        i += 2
      } else if ('+-*/^(),;<>='.includes(c)) {
        tokens.push({ k: 'op', v: c === ';' ? ',' : c })
        i++
      } else {
        throw new FormulaError(`Unexpected “${c}” at position ${i + 1}`)
      }
    }
  }
  return tokens
}

function parse(tokens: Token[]): Node {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Expected “${v}”`)
    pos++
  }

  const comparison = (): Node => {
    let node = additive()
    while (peek()?.k === 'op' && ['<', '<=', '>', '>=', '=', '<>'].includes(String(peek()!.v))) {
      const op = String(tokens[pos++].v)
      node = { t: 'bin', op, a: node, b: additive() }
    }
    return node
  }
  const additive = (): Node => {
    let node = multiplicative()
    while (isOp('+') || isOp('-')) {
      const op = String(tokens[pos++].v)
      node = { t: 'bin', op, a: node, b: multiplicative() }
    }
    return node
  }
  const multiplicative = (): Node => {
    let node = unary()
    while (isOp('*') || isOp('/')) {
      const op = String(tokens[pos++].v)
      node = { t: 'bin', op, a: node, b: unary() }
    }
    return node
  }
  const unary = (): Node => {
    if (isOp('-')) {
      pos++
      return { t: 'neg', a: unary() }
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }
  const power = (): Node => {
    const base = primary()
    if (isOp('^')) {
      pos++
      return { t: 'bin', op: '^', a: base, b: unary() }
    }
    return base
  }
  const primary = (): Node => {
    const tok = peek()
    if (!tok) throw new FormulaError('The formula ends unexpectedly')
    pos++
    if (tok.k === 'num') return { t: 'num', v: tok.v }
    if (tok.k === 'ref') return { t: 'ref', name: tok.v, bracketed: true }
    if (tok.k === 'op' && tok.v === '(') {
      const inner = comparison()
      expect(')')
      return inner
    }
    if (tok.k === 'id') {
      if (isOp('(')) {
        const fn = tok.v.toUpperCase()
        const spec = FUNCTIONS[fn]
        if (!spec) throw new FormulaError(`Unknown function ${tok.v}()`)
        pos++
        const args: Node[] = []
        if (!isOp(')')) {
          args.push(comparison())
          while (isOp(',')) {
            pos++
            args.push(comparison())
          }
        }
        expect(')')
        if (args.length < spec.min || args.length > spec.max) throw new FormulaError(`${fn}() has the wrong number of arguments`)
        return { t: 'call', fn, args }
      }
      return { t: 'ref', name: tok.v, bracketed: false }
    }
    throw new FormulaError(`Unexpected “${tok.v}”`)
  }

  const node = comparison()
  if (pos < tokens.length) throw new FormulaError(`Unexpected “${String(tokens[pos].v)}”`)
  return node
}

/** Supplies a column's numbers by reference name; null when the name is unknown. */
export type RefResolver = (name: string, bracketed: boolean) => ((row: number) => number | null) | null

export interface CompiledFormula {
  /** References that could not be resolved against the current columns. */
  missing: string[]
  evaluate: (row: number) => number | null
}

function roundTo(fn: string, x: number, digits: number): number {
  if (fn === 'ROUND') return excelRound(x, digits)
  const f = 10 ** digits
  const v = Math.abs(x) * f
  const r = fn === 'ROUNDUP' ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9)
  return (Math.sign(x) * r) / f
}

export function parseFormula(src: string): Node {
  if (!src.trim()) throw new FormulaError('The formula is empty')
  return parse(tokenize(src))
}

/** Validates syntax only (no column check). Returns an error message or null. */
export function formulaError(src: string): string | null {
  try {
    parseFormula(src)
    return null
  } catch (e) {
    return e instanceof FormulaError ? e.message : 'Invalid formula'
  }
}

export function compileFormula(src: string, resolve: RefResolver): CompiledFormula {
  const ast = parseFormula(src)
  const missing: string[] = []

  const build = (n: Node): ((row: number) => number | null) => {
    switch (n.t) {
      case 'num':
        return () => n.v
      case 'ref': {
        const get = resolve(n.name, n.bracketed)
        if (!get) {
          missing.push(n.name)
          return () => null
        }
        return get
      }
      case 'neg': {
        const a = build(n.a)
        return (r) => {
          const x = a(r)
          return x === null ? null : -x
        }
      }
      case 'bin': {
        const a = build(n.a)
        const b = build(n.b)
        return (r) => {
          const x = a(r)
          const y = b(r)
          if (x === null || y === null) return null
          switch (n.op) {
            case '+': return x + y
            case '-': return x - y
            case '*': return x * y
            case '/': return y === 0 ? null : x / y
            case '^': return x ** y
            case '<': return x < y ? 1 : 0
            case '<=': return x <= y ? 1 : 0
            case '>': return x > y ? 1 : 0
            case '>=': return x >= y ? 1 : 0
            case '=': return x === y ? 1 : 0
            default: return x !== y ? 1 : 0
          }
        }
      }
      case 'call': {
        const args = n.args.map(build)
        return (r) => {
          if (n.fn === 'IF') {
            const c = args[0](r)
            return c === null ? null : c !== 0 ? args[1](r) : args[2](r)
          }
          const vals = args.map((f) => f(r))
          if (vals.some((v) => v === null)) return null
          const v = vals as number[]
          switch (n.fn) {
            case 'MIN': return Math.min(...v)
            case 'MAX': return Math.max(...v)
            case 'ABS': return Math.abs(v[0])
            default: return roundTo(n.fn, v[0], v[1] ?? 0)
          }
        }
      }
    }
  }

  const fn = build(ast)
  return {
    missing,
    evaluate: (row) => {
      const v = fn(row)
      return v === null || !Number.isFinite(v) ? null : v
    },
  }
}

/** Matches a reference name to a header the way formulas expect (case/space/accent-insensitive). */
export function sameHeader(reference: string, header: string): boolean {
  return normalizeHeader(reference) === normalizeHeader(header)
}
