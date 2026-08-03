import { vi } from 'vite-plus/test'
import { fetchGithubRelease } from '../../fetcher'
import release from '../fixtures/release.json'

import type { GitHubRelease, Fetcher, FetcherOptions } from '../../types'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchGithubRelease', () => {
  test('default', async () => {
    // mocking
    fetchMock.mockResolvedValueOnce(Response.json(release))

    // assertion
    expect(
      await fetchGithubRelease(release.tag_name, {
        github: 'kazupon/gh-changelogen',
        token: 'foo'
      } as FetcherOptions)
    ).toEqual(release)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.github.com/repos/kazupon/gh-changelogen/releases/tags/${release.tag_name}`,
      {
        headers: {
          accept: 'application/vnd.github.v3+json',
          authorization: 'token foo'
        },
        method: 'GET'
      }
    )
  })

  test('default fetcher error', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))

    await expect(
      fetchGithubRelease(release.tag_name, { github: 'kazupon/gh-changelogen' })
    ).rejects.toThrow('GitHub API request failed: 404 Not Found')
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
    const myFetcher: Fetcher = async () => {
      return new Promise(resolve => {
        // api call ...
        setTimeout(() => resolve(releaseData), 100)
      })
    }

    // assertion
    expect(await fetchGithubRelease(releaseData.tag_name, { fetcher: myFetcher })).toEqual(
      releaseData
    )
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
