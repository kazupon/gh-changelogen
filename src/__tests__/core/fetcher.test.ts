import { vi } from 'vitest'
import { $fetch } from 'ohmyfetch'
import { fetchGithubRelease } from '../../fetcher'
import release from '../fixtures/release.json'

import type { GitHubRelease, Fetcher, FetcherOptions } from '../../types'

vi.mock('ohmyfetch', async () => {
  return {
    $fetch: vi.fn()
  }
})

describe('fetchGithubRelease', () => {
  test('default', async () => {
    // mocking
    vi.mocked($fetch).mockImplementationOnce(() => {
      return Promise.resolve(release)
    })

    // assertion
    expect(
      await fetchGithubRelease(release.tag_name, { github: 'kazupon/gh-changelogen', token: 'foo' } as FetcherOptions)
    ).toEqual(release)
  })

  test('custom fetcher', async () => {
    const releaseData = {
      name: 'first release',
      tag_name: 'v0.0.0',
      published_at: '2022-08-22T17:22:41Z',
      url: 'https://github.com/your/repo/releases/tag/v0.0.0',
      body: 'This is initial release'
    } as GitHubRelease

    // custom fetcher (e.g GitHub API)
    const myFetcher: Fetcher = async (tag: string) => {
      return new Promise(resolve => {
        // api call ...
        setTimeout(() => resolve(releaseData), 100)
      })
    }

    // assertion
    expect(await fetchGithubRelease(releaseData.tag_name, { fetcher: myFetcher })).toEqual(releaseData)
  })

  test('not compatible fetcher', async () => {
    // not callable fetcher
    const myFetcher: Fetcher = 'not callable' as unknown as Fetcher

    // assertions
    await expect(fetchGithubRelease(release.tag_name, { fetcher: myFetcher })).rejects.toThrow(
      'fetcher is not a function'
    )
  })
})
