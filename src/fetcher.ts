import { isFunction } from './utils'
import { parseGithubRepository } from './release-notes'

import type { GitHubGeneratedReleaseNotes, GitHubRelease, Fetcher, FetcherOptions } from './types'

const GITHUB_API_VERSION = '2022-11-28' as const

export interface FetchGithubGeneratedReleaseNotesOptions {
  repository: string
  tagName: string
  targetCommitish: string
  token: string
}

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

export async function fetchGithubGeneratedReleaseNotes(
  options: FetchGithubGeneratedReleaseNotesOptions,
  fetcher: typeof fetch = globalThis.fetch
): Promise<GitHubGeneratedReleaseNotes> {
  const [owner, repository] = parseGithubRepository(options.repository)
  if (!options.tagName) {
    throw new Error('GitHub release tag name is required')
  }
  if (!options.targetCommitish) {
    throw new Error('GitHub release target commitish is required')
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/generate-notes`
  let response: Response

  try {
    response = await fetcher(url, {
      body: JSON.stringify({
        tag_name: options.tagName,
        target_commitish: options.targetCommitish
      }),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION
      },
      method: 'POST',
      redirect: 'error'
    })
  } catch (error) {
    throw new Error(`GitHub API request failed: ${sanitizeError(error, options.token)}`)
  }

  if (!response.ok) {
    const statusText = sanitizeError(response.statusText, options.token)
    throw new Error(`GitHub API request failed: ${response.status} ${statusText}`.trim())
  }

  let generated: unknown
  try {
    generated = await response.json()
  } catch {
    throw new Error('GitHub API returned invalid JSON for generated release notes')
  }

  if (!isGeneratedReleaseNotes(generated)) {
    throw new Error('GitHub API returned invalid generated release notes')
  }

  return generated
}

function isGeneratedReleaseNotes(value: unknown): value is GitHubGeneratedReleaseNotes {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof (value as Record<string, unknown>).body === 'string'
  )
}

function sanitizeError(error: unknown, token: string): string {
  const message = error instanceof Error ? error.message : String(error)
  return token ? message.split(token).join('[REDACTED]') : message
}
