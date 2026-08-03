import { vi } from 'vite-plus/test'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { fetchGithubRelease } from '../fetcher'
import { isCliValidationError, main } from '../cli'
import { isExists } from '../utils'
import release from './fixtures/release.json'

import type { GitHubRelease } from '../types'

vi.mock('../fetcher', () => {
  return {
    fetchGithubRelease: vi.fn<typeof fetchGithubRelease>()
  }
})

let orgCwd: typeof process.cwd

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
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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
  expect(spyLog).toHaveBeenCalledTimes(1)
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

test('keeps permissive unknown-option behavior', async () => {
  const spyFetchGithubRelease = vi
    .mocked(fetchGithubRelease)
    .mockResolvedValueOnce(release as unknown as GitHubRelease)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main([
    '--unknown',
    '--repo',
    'kazupon/gh-changelogen',
    '--tag',
    release.tag_name,
    '--token',
    'foo'
  ])

  expect(spyFetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'foo'
  })
})

test('token default', async () => {
  // mocking
  const spyFetchGithubRelease = vi.mocked(fetchGithubRelease).mockImplementationOnce(() => {
    return Promise.resolve(release as unknown as GitHubRelease)
  })
  vi.stubEnv('GITHUB_TOKEN', 'bar')
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
  vi.stubEnv('GITHUB_TOKEN', '')
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  // assertion
  await expect(
    main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])
  ).rejects.toThrow('Not found GITHUB_TOKEN in env')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(spyLog).not.toHaveBeenCalled()
})

test('does not fetch a release for invalid input', async () => {
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  const error = await main([
    '--repo',
    'kazupon/gh-changelogen',
    '--token',
    'foo',
    '--output',
    './HISTORY.md'
  ]).catch(error => error)
  expect(error).toBeInstanceOf(Error)
  expect(isCliValidationError(error)).toBe(true)
  const output = spyLog.mock.calls.map(([message = '']) => String(message)).join('\n')
  expect(output).toContain("Optional argument '--tag' is required")
  expect(output).not.toMatch(/AggregateError|ArgsValidationError/)
  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(await fs.readFile(resolve(process.cwd(), './HISTORY.md'), 'utf-8')).toBe('This is history')
  expect(await isExists(resolve(process.cwd(), './CHANGELOG.md'))).toBe(false)
})

test.each([
  ['no arguments', []],
  ['long help option', ['--help']],
  ['short help option', ['-h']],
  ['an ignored unknown option', ['--unknown', '--help']]
])('shows semantic help with %s', async (_name, args) => {
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(args)

  const output = spyLog.mock.calls.map(([message = '']) => String(message)).join('\n')
  expect(output).toContain('USAGE:')
  expect(output).toContain('OPTIONS:')
  expect(output).toContain('-h, --help')
  expect(output.split('--repo')).toHaveLength(2)
  expect(output.split('--tag')).toHaveLength(2)
  expect(output.split('--output')).toHaveLength(2)
  expect(output.split('--token')).toHaveLength(2)
  expect(output).toContain('(default: CHANGELOG.md)')
  expect(output).toContain('(default: GITHUB_TOKEN)')
  expect(output).not.toContain('--version')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test.each(['--version', '-v'])('does not provide %s', async option => {
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  await expect(main([option])).rejects.toThrow(`Unknown option: ${option}`)
  expect(spyLog).not.toHaveBeenCalled()
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test('does not fetch a release for unexpected positional input', async () => {
  await expect(
    main([
      '--repo',
      'kazupon/gh-changelogen',
      '--tag',
      release.tag_name,
      '--token',
      'foo',
      'unexpected'
    ])
  ).rejects.toThrow('Undefined: unexpected')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test('propagates runtime errors without writing a header', async () => {
  vi.mocked(fetchGithubRelease).mockRejectedValueOnce(new Error('fetch failed'))
  const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})

  await expect(
    main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name, '--token', 'foo'])
  ).rejects.toThrow('fetch failed')
  expect(spyLog).not.toHaveBeenCalled()
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
