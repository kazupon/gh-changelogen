import type { GitHubRelease, Generator } from './types'

function generator(release: GitHubRelease): Promise<string> {
  throw new Error('not implemented')
}

export async function generateChangelog(release: GitHubRelease, generator: string): Promise<string> {
  throw new Error('not implemented')
}
