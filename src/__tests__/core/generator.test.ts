import { generateChangelog, renderChangelogEntry } from '../../generator'
import release from '../fixtures/release.json'

import type { Generator, GitHubRelease } from '../../types'

describe('generateChangelog', () => {
  test('default', async () => {
    expect(await generateChangelog(release as unknown as GitHubRelease)).toMatchSnapshot()
  })

  test('custom generator', async () => {
    const myGenerator: Generator = async release => {
      return new Promise(resolve => {
        // do something ...
        setTimeout(() => resolve(`# ${release.name}`), 100)
      })
    }

    expect(await generateChangelog(release as unknown as GitHubRelease, myGenerator)).toContain(
      release.name
    )
  })

  test('not compatible generator', async () => {
    // not callable generator
    const myGenerator: Generator = 'not callable' as unknown as Generator

    // assertions
    await expect(
      generateChangelog(release as unknown as GitHubRelease, myGenerator)
    ).rejects.toThrow('generator is not a function')
  })
})

describe('renderChangelogEntry', () => {
  test('keeps the published release snapshot byte-compatible', async () => {
    const legacy = await generateChangelog(release as unknown as GitHubRelease)
    expect(
      renderChangelogEntry({
        body: release.body,
        htmlUrl: release.html_url,
        name: release.name,
        repository: 'kazupon/gh-changelogen',
        source: 'published-release',
        tagName: release.tag_name,
        timestamp: release.published_at
      })
    ).toBe(legacy)
  })

  test('falls back to the tag name', () => {
    expect(
      renderChangelogEntry({
        body: '',
        htmlUrl: 'https://github.com/owner/repo/releases/tag/v1.0.0',
        name: '',
        repository: 'owner/repo',
        source: 'generated-notes',
        tagName: 'v1.0.0',
        timestamp: '2026-08-03T00:00:00.000Z'
      })
    ).toMatch(/^# v1\.0\.0 \(2026-08-03T00:00:00\.000Z\)$/m)
  })
})
