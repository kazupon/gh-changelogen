import type { GitHubRelease, Fetcher } from './types'

function fetcher(tag: string): Promise<GitHubRelease> {
  throw new Error('not implemented')
}

export async function fetchGithubRelease(tag: string): Promise<GitHubRelease> {
  throw new Error('not implemented')
}
