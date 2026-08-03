import {
  createReleaseUrl,
  normalizeGeneratedReleaseNotes,
  normalizePublishedRelease,
  parseGithubRepository
} from '../../release-notes'
import release from '../fixtures/release.json'

import type { GitHubRelease } from '../../types'

describe('release notes normalization', () => {
  test('normalizes a published release', () => {
    expect(
      normalizePublishedRelease('kazupon/gh-changelogen', release as unknown as GitHubRelease)
    ).toEqual({
      body: release.body,
      htmlUrl: release.html_url,
      name: release.name,
      repository: 'kazupon/gh-changelogen',
      source: 'published-release',
      tagName: release.tag_name,
      timestamp: release.published_at
    })
  })

  test('falls back to the published tag for an empty name', () => {
    expect(
      normalizePublishedRelease('owner/repo', {
        ...(release as unknown as GitHubRelease),
        name: ''
      }).name
    ).toBe(release.tag_name)
  })

  test('normalizes generated notes without changing their body', () => {
    const body = '## Changes\n\n- Preserve **Markdown** exactly.'
    expect(
      normalizeGeneratedReleaseNotes({
        generated: { body, name: '' },
        repository: 'owner/repo',
        startedAt: new Date('2026-08-03T01:02:03.456Z'),
        tagName: 'release/1.2.3',
        targetCommitish: '0123456789abcdef'
      })
    ).toEqual({
      body,
      htmlUrl: 'https://github.com/owner/repo/releases/tag/release%2F1.2.3',
      name: 'release/1.2.3',
      repository: 'owner/repo',
      source: 'generated-notes',
      tagName: 'release/1.2.3',
      targetCommitish: '0123456789abcdef',
      timestamp: '2026-08-03T01:02:03.456Z'
    })
  })
})

describe('GitHub repository and release URLs', () => {
  test('encodes path components', () => {
    expect(createReleaseUrl('owner name/repo name', 'v1/next')).toBe(
      'https://github.com/owner%20name/repo%20name/releases/tag/v1%2Fnext'
    )
  })

  test.each(['', 'owner', 'owner/', '/repo', 'owner/repo/extra'])(
    'rejects invalid repository %j',
    repository => {
      expect(() => parseGithubRepository(repository)).toThrow('expected owner/repo')
    }
  )
})
