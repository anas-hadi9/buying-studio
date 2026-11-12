import { indexedDbStore, memoryStore } from './storage/keyValue'
import { createLocalRepositories } from './storage/localRepositories'
import type { Repositories } from './storage/repositories'

/**
 * Composition root for storage. To move to a server, implement Repositories
 * over HTTP and return it here — stores and features stay unchanged.
 */
function createRepositories(): Repositories {
  const hasIndexedDb = typeof indexedDB !== 'undefined'
  return createLocalRepositories(hasIndexedDb ? indexedDbStore() : memoryStore())
}

let repositories: Repositories | null = null

export function getRepositories(): Repositories {
  repositories ??= createRepositories()
  return repositories
}

/** For tests. */
export function setRepositories(r: Repositories) {
  repositories = r
}
