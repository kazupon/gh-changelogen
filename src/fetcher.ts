import { $fetch } from 'ohmyfetch'
import { isFunction } from './utils'

import type { GitHubRelease, Fetcher, FetcherOptions } from './types'

function getHeaders(options: FetcherOptions) {
  return {
    accept: 'application/vnd.github.v3+json',
    authorization: `token ${options.token}`
  }
}

async function fetcherDefault(tag: string, options: FetcherOptions = {}): Promise<GitHubRelease> {
  if (!options.github) {
    throw new Error(`'github' option is required`)
  }

  const url = `https://api.github.com/repos/${options.github}/releases/tags/${tag}`
  return $fetch<GitHubRelease>(url, { headers: getHeaders(options), method: 'GET' })
}

export async function fetchGithubRelease(
  tag: string,
  options?: { fetcher?: Fetcher } & FetcherOptions
): Promise<GitHubRelease> {
  const fetcher = options?.fetcher ?? fetcherDefault
  if (!isFunction(fetcher)) {
    throw new Error('fetcher is not a function')
  }
  return fetcher(tag, options)
}
