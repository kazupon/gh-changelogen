import { vi } from 'vite-plus/test'
import { fetchGithubGeneratedReleaseNotes, fetchGithubRelease } from '../../fetcher'
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

describe('fetchGithubGeneratedReleaseNotes', () => {
  const options = {
    repository: 'kazupon/gh-changelogen',
    tagName: 'v1.2.3',
    targetCommitish: '0123456789abcdef',
    token: 'generated-token'
  }

  test('posts a fixed target SHA using the GitHub REST contract', async () => {
    const generated = {
      name: 'v1.2.3',
      body: '## Changes\n\n- Added generated notes.'
    }
    fetchMock.mockResolvedValueOnce(Response.json(generated))

    await expect(fetchGithubGeneratedReleaseNotes(options)).resolves.toEqual(generated)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/kazupon/gh-changelogen/releases/generate-notes',
      {
        body: JSON.stringify({
          tag_name: 'v1.2.3',
          target_commitish: '0123456789abcdef'
        }),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer generated-token',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        method: 'POST',
        redirect: 'error'
      }
    )
  })

  test('encodes repository path components', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ body: '', name: '' }))

    await fetchGithubGeneratedReleaseNotes({
      ...options,
      repository: 'owner name/repo name'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner%20name/repo%20name/releases/generate-notes',
      expect.any(Object)
    )
  })

  test.each(['owner', 'owner/repo/extra', '/repo', 'owner/'])(
    'rejects invalid repository %j before fetching',
    async repository => {
      await expect(fetchGithubGeneratedReleaseNotes({ ...options, repository })).rejects.toThrow(
        'expected owner/repo'
      )
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  test.each([401, 403, 404, 422, 429])(
    'reports HTTP %i without exposing the token',
    async status => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status, statusText: `failure generated-token ${status}` })
      )

      const error = await fetchGithubGeneratedReleaseNotes(options).catch(error => error)
      expect(error).toBeInstanceOf(Error)
      expect(String(error)).toContain(String(status))
      expect(String(error)).not.toContain(options.token)
    }
  )

  test('rejects invalid JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{', {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    )

    await expect(fetchGithubGeneratedReleaseNotes(options)).rejects.toThrow(
      'GitHub API returned invalid JSON for generated release notes'
    )
  })

  test.each([null, {}, { body: '', name: null }, { body: null, name: '' }])(
    'rejects an invalid response shape %#',
    async generated => {
      fetchMock.mockResolvedValueOnce(Response.json(generated))

      await expect(fetchGithubGeneratedReleaseNotes(options)).rejects.toThrow(
        'GitHub API returned invalid generated release notes'
      )
    }
  )

  test('accepts empty strings and ignores extra response fields', async () => {
    const generated = { body: '', name: '', nested: {}, unexpected: true }
    fetchMock.mockResolvedValueOnce(Response.json(generated))

    await expect(fetchGithubGeneratedReleaseNotes(options)).resolves.toEqual(generated)
  })

  test('redacts the token from network errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error(`network rejected ${options.token}`))

    const error = await fetchGithubGeneratedReleaseNotes(options).catch(error => error)
    expect(String(error)).toContain('[REDACTED]')
    expect(String(error)).not.toContain(options.token)
  })
})
