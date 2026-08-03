import type { GitHubGeneratedReleaseNotes, GitHubRelease, ReleaseNotes } from './types'

export interface NormalizeGeneratedReleaseNotesOptions {
  generated: GitHubGeneratedReleaseNotes
  repository: string
  startedAt: Date
  tagName: string
  targetCommitish: string
}

export function normalizePublishedRelease(
  repository: string,
  release: GitHubRelease
): ReleaseNotes {
  return {
    body: release.body,
    htmlUrl: release.html_url,
    name: release.name || release.tag_name,
    repository,
    source: 'published-release',
    tagName: release.tag_name,
    timestamp: release.published_at
  }
}

export function normalizeGeneratedReleaseNotes({
  generated,
  repository,
  startedAt,
  tagName,
  targetCommitish
}: NormalizeGeneratedReleaseNotesOptions): ReleaseNotes {
  return {
    body: generated.body,
    htmlUrl: createReleaseUrl(repository, tagName),
    name: generated.name || tagName,
    repository,
    source: 'generated-notes',
    tagName,
    targetCommitish,
    timestamp: startedAt.toISOString()
  }
}

export function createReleaseUrl(repository: string, tagName: string): string {
  const [owner, name] = parseGithubRepository(repository)
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/tag/${encodeURIComponent(tagName)}`
}

export function parseGithubRepository(repository: string): [owner: string, name: string] {
  const components = repository.split('/')
  if (components.length !== 2 || components.some(component => component.length === 0)) {
    throw new Error(`Invalid GitHub repository '${repository}'; expected owner/repo`)
  }
  return [components[0], components[1]]
}
