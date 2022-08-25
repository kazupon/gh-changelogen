import { spawn } from 'node:child_process'
import { fetchGithubRelease } from '../../fetcher'
import { normalizeGithubRelease } from '../../utils'
import release from '../fixtures/release.json'

import type { ChildProcess } from 'node:child_process'
import type { GitHubRelease, Fetcher } from '../../types'

vi.mock('../../utils', async () => {
  const { isFunction, normalizeGithubRelease } = await vi.importActual('../../utils')
  return {
    isFunction,
    normalizeGithubRelease,
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
    expect(await fetchGithubRelease(release.tagName)).toEqual(normalizeGithubRelease(release))
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
    expect(await fetchGithubRelease(releaseData.tag_name, myFetcher)).toEqual(releaseData)
  })

  test('not compatible fetcher', async () => {
    // not callable fetcher
    const myFetcher: Fetcher = 'not callable' as unknown as Fetcher

    // assertions
    await expect(fetchGithubRelease(release.tagName, myFetcher)).rejects.toThrow('fetcher is not a function')
  })
})
