import { getRedisUrl } from '@/lib/env'

export function getRedisConnectionOptions() {
  const url = getRedisUrl()
  return {
    url: url.includes('?') ? url : `${url}?family=0`,
    maxRetriesPerRequest: null as unknown as undefined,
    enableReadyCheck: false,
    lazyConnect: true,
  }
}

/** Worker connection. */
export function getWorkerRedisConnectionOptions() {
  const url = getRedisUrl()
  return {
    url: url.includes('?') ? url : `${url}?family=0`,
    maxRetriesPerRequest: null as unknown as undefined,
    enableReadyCheck: false,
    lazyConnect: true,
  }
}
