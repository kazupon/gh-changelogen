import { vi } from 'vite-plus/test'
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
    fetchGithubRelease: vi.fn<typeof fetchGithubRelease>()
  }
})

let orgCwd: typeof process.cwd
beforeAll(() => {
  // for zodiarg
  // @ts-expect-error
  vi.spyOn(process, 'exit').mockImplementation(() => {})
})

beforeEach(async () => {
  orgCwd = process.cwd.bind(process)
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
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(() => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  // call
  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name, '--token', 'foo'])

  // assertion
  expect(spyFetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'foo'
  })
  expect(spyLog.mock.calls[0][0]).toMatchSnapshot()
  const output = resolve(process.cwd(), './CHANGELOG.md')
  expect(await isExists(output)).toBe(true)
  expect(await fs.readFile(output, 'utf-8')).toBe(`${spyLog.mock.calls[0][0]}\n`)
})

test('equals option syntax', async () => {
  const spyFetchGithubRelease = vi
    .mocked(fetchGithubRelease)
    .mockResolvedValueOnce(release as unknown as GitHubRelease)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(['--repo=kazupon/gh-changelogen', `--tag=${release.tag_name}`, '--token=equals-token'])

  expect(spyFetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'equals-token'
  })
})

test('token default', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(() => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  vi.spyOn(process, 'env', 'get').mockImplementation(() => ({ GITHUB_TOKEN: 'bar' }))
  vi.spyOn(console, 'log').mockImplementation(() => {})

  // call
  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])

  // assertion
  expect(spyFetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'bar'
  })
})

test('not found default token', async () => {
  // mocking
  vi.mocked(fetchGithubRelease).mockImplementationOnce(() => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  vi.spyOn(process, 'env', 'get').mockImplementation(() => ({}))

  // assertion
  await expect(
    main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])
  ).rejects.toThrow('Not found GITHUB_TOKEN in env')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test('does not fetch a release for invalid input', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  await expect(main(['--repo', 'kazupon/gh-changelogen', '--token', 'foo'])).rejects.toThrow(/.+/)
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test('write changelog to output', async () => {
  // mocking
  vi.mocked(fetchGithubRelease).mockImplementationOnce(() => {
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
