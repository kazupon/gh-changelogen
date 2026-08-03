import { isFunction } from './utils'

import type { GitHubRelease, Fetcher, FetcherOptions } from './types'

function getHeaders(options: FetcherOptions) {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github.v3+json'
  }
  if (options.token) {
    headers.authorization = `token ${options.token}`
  }
  return headers
}

async function fetcherDefault(tag: string, options: FetcherOptions = {}): Promise<GitHubRelease> {
  if (!options.github) {
    throw new Error(`'github' option is required`)
  }

  const url = `https://api.github.com/repos/${options.github}/releases/tags/${tag}`
  const response = await fetch(url, { headers: getHeaders(options), method: 'GET' })
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as GitHubRelease
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
