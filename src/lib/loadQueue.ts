/**
 * Limits how many downloads run at once, first come first served.
 *
 * Product photos are often full-size originals (hundreds of KB to several MB)
 * on small servers. Starting dozens at once when a buyer scrolls makes every
 * photo slow and can make the server drop connections. Queueing lets on-screen
 * photos finish first, and photos scrolled past before their turn never start.
 */
export class LoadQueue {
  private active = 0
  private waiting: (() => void)[] = []

  constructor(private readonly limit: number) {}

  /**
   * Asks for a slot; `start` runs once one is free (possibly immediately).
   * Returns `release`: call it when the download finishes or is no longer
   * needed. Releasing a request that hasn't started just removes it.
   * `urgent` requests (e.g. the photo a buyer just opened) go to the front.
   */
  request(start: () => void, { urgent = false }: { urgent?: boolean } = {}): () => void {
    let state: 'waiting' | 'running' | 'done' = 'waiting'
    const run = () => {
      state = 'running'
      this.active++
      start()
    }
    if (urgent) this.waiting.unshift(run)
    else this.waiting.push(run)
    this.pump()
    return () => {
      if (state === 'waiting') {
        this.waiting = this.waiting.filter((r) => r !== run)
      } else if (state === 'running') {
        this.active--
        this.pump()
      }
      state = 'done'
    }
  }

  get size() {
    return { active: this.active, waiting: this.waiting.length }
  }

  private pump() {
    while (this.active < this.limit && this.waiting.length > 0) this.waiting.shift()!()
  }
}
