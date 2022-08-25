import { spawn } from 'node:child_process'
import { fetchGithubRelease } from '../../fetcher'
import release from '../fixtures/release.json'

import type { ChildProcess } from 'node:child_process'
import type { GitHubRelease, Fetcher } from '../../types'

vi.mock('../../utils', () => {
  return {
    existCommand: vi.fn().mockImplementation(() => Promise.resolve(true))
  }
})

vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  }
})

describe('fetchGithubRelease', () => {
  test('default', async () => {
    // mocking
    const on = vi.fn().mockImplementationOnce((event: string, cb: Function) => {
      if (event === 'data') {
        cb(JSON.stringify(release))
      }
    })
    vi.mocked(spawn).mockImplementationOnce(() => {
      return { stdout: { on } } as unknown as ChildProcess
    })

    // assertion
    expect(await fetchGithubRelease(release.tagName)).toEqual(release)
  })

  test('custom fetcher', async () => {
    const releaseData: GitHubRelease = {
      name: 'first release',
      tagName: 'v0.0.0',
      publishedAt: '2022-08-22T17:22:41Z',
      url: 'https://github.com/your/repo/releases/tag/v0.0.0',
      body: 'This is initial release'
    }

    // custom fetcher (e.g GitHub API)
    const myFetcher: Fetcher = async (tag: string) => {
      return new Promise(resolve => {
        // api call ...
        setTimeout(() => resolve(releaseData), 100)
      })
    }

    // assertion
    expect(await fetchGithubRelease(releaseData.tagName, myFetcher)).toEqual(releaseData)
  })

  test('not compatible fetcher', async () => {
    // not callable fetcher
    const myFetcher: Fetcher = 'not callable' as unknown as Fetcher

    // assertions
    await expect(fetchGithubRelease(release.tagName, myFetcher)).rejects.toThrow('fetcher is not a function')
  })
})
