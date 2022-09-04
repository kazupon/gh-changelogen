import { vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { fetchGithubRelease } from '../fetcher'
import { main } from '../cli'
import { isExists } from '../utils'
import release from './fixtures/release.json'

import type { GitHubRelease } from '../types'

vi.mock('../fetcher', () => {
  return {
    fetchGithubRelease: vi.fn()
  }
})

let orgCwd: typeof process.cwd
beforeAll(() => {
  // for zodiarg
  // @ts-expect-error
  vi.spyOn(process, 'exit').mockImplementation(() => {})
})

beforeEach(async () => {
  orgCwd = process.cwd
  process.cwd = () => fileURLToPath(new URL('./fixtures/output', import.meta.url))
  await fs.writeFile(resolve(process.cwd(), './HISTORY.md'), 'This is history', 'utf-8')
})

afterEach(async () => {
  try {
    await fs.unlink(resolve(process.cwd(), './HISTORY.md'))
    await fs.unlink(resolve(process.cwd(), './CHANGELOG.md'))
  } catch {}
  process.cwd = orgCwd
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
  expect(await isExists(resolve(process.cwd(), './CHANGELOG.md'))).toBe(true)
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

test('write changelog to output', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(tag => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })

  // call
  await main([
    '--repo',
    'kazupon/gh-changelogen',
    '--tag',
    release.tag_name,
    '--token',
    'foo',
    '--output',
    './HISTORY.md'
  ])

  // assertion
  const history = await fs.readFile(resolve(process.cwd(), './HISTORY.md'), 'utf-8')
  expect(history).toMatchSnapshot()
})
