import { vi } from 'vitest'
import { fetchGithubRelease } from '../fetcher'
import { main } from '../cli'
import release from './fixtures/release.json'

import type { GitHubRelease } from '../types'

vi.mock('../fetcher', () => {
  return {
    fetchGithubRelease: vi.fn()
  }
})

beforeAll(() => {
  // for zodiarg
  // @ts-expect-error
  vi.spyOn(process, 'exit').mockImplementation(() => {})
})

test('basic', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(tag => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  // call
  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name, '--token', 'foo'])

  // assertion
  expect(spyFetchGithubRelease).toBeCalledWith(release.tag_name, { github: 'kazupon/gh-changelogen', token: 'foo' })
  expect(spyLog.mock.calls[0][0]).toMatchSnapshot()
})

test('token default', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(tag => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  vi.spyOn(process, 'env', 'get').mockImplementation(() => ({ GITHUB_TOKEN: 'bar' }))
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  // call
  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])

  // assertion
  expect(spyFetchGithubRelease).toBeCalledWith(release.tag_name, { github: 'kazupon/gh-changelogen', token: 'bar' })
})

test('not found default token', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(tag => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  vi.spyOn(process, 'env', 'get').mockImplementation(() => ({}))

  // assertion
  await expect(main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])).rejects.toThrow(
    'Not found GITHUB_TOKEN in env'
  )
})
