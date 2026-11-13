import { describe, expect, it } from 'vitest'
import { LoadQueue } from './loadQueue'

describe('LoadQueue', () => {
  it('runs at most `limit` at once, in request order', () => {
    const q = new LoadQueue(2)
    const started: string[] = []
    const r1 = q.request(() => started.push('a'))
    q.request(() => started.push('b'))
    q.request(() => started.push('c'))
    expect(started).toEqual(['a', 'b'])
    expect(q.size).toEqual({ active: 2, waiting: 1 })
    r1()
    expect(started).toEqual(['a', 'b', 'c'])
  })

  it('drops waiting requests that are released before they start', () => {
    const q = new LoadQueue(1)
    const started: string[] = []
    const r1 = q.request(() => started.push('a'))
    const r2 = q.request(() => started.push('b'))
    q.request(() => started.push('c'))
    r2()
    r1()
    expect(started).toEqual(['a', 'c'])
  })

  it('puts urgent requests at the front of the line', () => {
    const q = new LoadQueue(1)
    const started: string[] = []
    const r1 = q.request(() => started.push('a'))
    q.request(() => started.push('b'))
    q.request(() => started.push('urgent'), { urgent: true })
    r1()
    expect(started).toEqual(['a', 'urgent'])
  })

  it('ignores double releases', () => {
    const q = new LoadQueue(1)
    const r1 = q.request(() => {})
    r1()
    r1()
    expect(q.size).toEqual({ active: 0, waiting: 0 })
  })
})
