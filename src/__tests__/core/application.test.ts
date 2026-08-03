import { vi } from 'vite-plus/test'

import {
  generateGithubReleaseNotesWithDependencies,
  updateChangelogWithDependencies
} from '../../application'
import release from '../fixtures/release.json'

import type { GitHubRelease } from '../../types'
import type { ChangelogApplicationDependencies } from '../../application'

const repository = 'kazupon/gh-changelogen'
const tagName = 'v1.2.3'
const targetCommitish = '0123456789abcdef'
const startedAt = new Date('2026-08-03T01:02:03.456Z')

describe('generateGithubReleaseNotes', () => {
  test('resolves the target once and normalizes generated notes', async () => {
    const clock = vi.fn<ChangelogApplicationDependencies['clock']>(() => startedAt)
    const resolveCommitish = vi.fn<ChangelogApplicationDependencies['resolveCommitish']>(
      async () => targetCommitish
    )
    const fetchGeneratedReleaseNotes = vi.fn<
      ChangelogApplicationDependencies['fetchGeneratedReleaseNotes']
    >(async () => ({ body: '## Changes', name: 'Generated release' }))

    await expect(
      generateGithubReleaseNotesWithDependencies(
        { repository, tagName, token: 'explicit-token' },
        {
          clock,
          cwd: () => '/repository',
          fetchGeneratedReleaseNotes,
          resolveCommitish
        }
      )
    ).resolves.toEqual({
      body: '## Changes',
      htmlUrl: `https://github.com/${repository}/releases/tag/${tagName}`,
      name: 'Generated release',
      repository,
      source: 'generated-notes',
      tagName,
      targetCommitish,
      timestamp: startedAt.toISOString()
    })

    expect(clock).toHaveBeenCalledOnce()
    expect(resolveCommitish).toHaveBeenCalledWith('HEAD', { cwd: '/repository' })
    expect(fetchGeneratedReleaseNotes).toHaveBeenCalledWith(
      {
        repository,
        tagName,
        targetCommitish,
        token: 'explicit-token'
      },
      expect.any(Function)
    )
  })

  test('uses the explicit target commitish', async () => {
    const resolveCommitish = vi.fn<ChangelogApplicationDependencies['resolveCommitish']>(
      async () => targetCommitish
    )

    await generateGithubReleaseNotesWithDependencies(
      { repository, tagName, targetCommitish: 'main', token: 'token' },
      {
        fetchGeneratedReleaseNotes: async () => ({ body: '', name: '' }),
        resolveCommitish
      }
    )

    expect(resolveCommitish).toHaveBeenCalledWith('main', { cwd: process.cwd() })
  })
})

describe('updateChangelog', () => {
  test('uses published-release by default and resolves a relative output', async () => {
    const fetchRelease = vi.fn<ChangelogApplicationDependencies['fetchRelease']>(
      async () => release as unknown as GitHubRelease
    )
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>(
      async () => 'prepended'
    )

    const result = await updateChangelogWithDependencies(
      {
        output: 'docs/HISTORY.md',
        repository,
        tagName: release.tag_name,
        token: 'token'
      },
      {
        cwd: () => '/repository',
        fetchRelease,
        storeEntry
      }
    )

    expect(fetchRelease).toHaveBeenCalledWith(release.tag_name, {
      github: repository,
      token: 'token'
    })
    expect(result.action).toBe('prepended')
    expect(result.output).toBe('/repository/docs/HISTORY.md')
    expect(result.releaseNotes.source).toBe('published-release')
    expect(storeEntry).toHaveBeenCalledWith({
      entry: result.entry,
      output: result.output,
      releaseUrl: release.html_url
    })
  })

  test('routes generated notes through the same store', async () => {
    const resolveCommitish = vi.fn<ChangelogApplicationDependencies['resolveCommitish']>(
      async () => targetCommitish
    )
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>(async () => 'created')

    const result = await updateChangelogWithDependencies(
      {
        repository,
        source: 'generated-notes',
        tagName,
        targetCommitish: 'main',
        token: 'token'
      },
      {
        clock: () => startedAt,
        fetchGeneratedReleaseNotes: async () => ({ body: 'body', name: tagName }),
        resolveCommitish,
        storeEntry
      }
    )

    expect(resolveCommitish).toHaveBeenCalledWith('main', { cwd: process.cwd() })
    expect(result.releaseNotes.targetCommitish).toBe(targetCommitish)
    expect(result.releaseNotes.timestamp).toBe(startedAt.toISOString())
    expect(storeEntry).toHaveBeenCalledOnce()
  })

  test('rejects targetCommitish for a published source before any request or write', async () => {
    const fetchRelease = vi.fn<ChangelogApplicationDependencies['fetchRelease']>()
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>()

    await expect(
      updateChangelogWithDependencies(
        { repository, tagName, targetCommitish: 'main', token: 'token' },
        { fetchRelease, storeEntry }
      )
    ).rejects.toThrow('targetCommitish requires generated-notes source')
    expect(fetchRelease).not.toHaveBeenCalled()
    expect(storeEntry).not.toHaveBeenCalled()
  })

  test('does not write when token resolution fails', async () => {
    const fetchRelease = vi.fn<ChangelogApplicationDependencies['fetchRelease']>()
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>()

    await expect(
      updateChangelogWithDependencies(
        { repository, tagName },
        { environment: {}, fetchRelease, storeEntry }
      )
    ).rejects.toThrow('GH_TOKEN or GITHUB_TOKEN')
    expect(fetchRelease).not.toHaveBeenCalled()
    expect(storeEntry).not.toHaveBeenCalled()
  })

  test('does not write after a Git resolution failure', async () => {
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>()
    await expect(
      updateChangelogWithDependencies(
        { repository, source: 'generated-notes', tagName, token: 'token' },
        {
          resolveCommitish: async () => Promise.reject(new Error('git failed')),
          storeEntry
        }
      )
    ).rejects.toThrow('git failed')
    expect(storeEntry).not.toHaveBeenCalled()
  })

  test('does not write after a GitHub request failure', async () => {
    const storeEntry = vi.fn<ChangelogApplicationDependencies['storeEntry']>()
    await expect(
      updateChangelogWithDependencies(
        { repository, source: 'generated-notes', tagName, token: 'token' },
        {
          fetchGeneratedReleaseNotes: async () => Promise.reject(new Error('request failed')),
          resolveCommitish: async () => targetCommitish,
          storeEntry
        }
      )
    ).rejects.toThrow('request failed')
    expect(storeEntry).not.toHaveBeenCalled()
  })
})
