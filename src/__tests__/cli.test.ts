import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { vi } from 'vite-plus/test'

import packageJson from '../../package.json' with { type: 'json' }
import { isCliValidationError, main } from '../cli'
import { fetchGithubGeneratedReleaseNotes, fetchGithubRelease } from '../fetcher'
import { resolveGitCommitish } from '../git'
import { isExists } from '../utils'
import release from './fixtures/release.json'

import type { GitHubRelease } from '../types'

vi.mock('../fetcher', () => ({
  fetchGithubGeneratedReleaseNotes: vi.fn<typeof fetchGithubGeneratedReleaseNotes>(),
  fetchGithubRelease: vi.fn<typeof fetchGithubRelease>()
}))

vi.mock('../git', () => ({
  resolveGitCommitish: vi.fn<typeof resolveGitCommitish>()
}))

let originalCwd: typeof process.cwd

beforeEach(async () => {
  originalCwd = process.cwd.bind(process)
  process.cwd = () => fileURLToPath(new URL('./fixtures/output', import.meta.url))
  vi.stubEnv('GH_TOKEN', '')
  vi.stubEnv('GITHUB_TOKEN', '')
  vi.mocked(fetchGithubRelease).mockReset()
  vi.mocked(fetchGithubGeneratedReleaseNotes).mockReset()
  vi.mocked(resolveGitCommitish).mockReset()
  await fs.writeFile(resolve(process.cwd(), './HISTORY.md'), 'This is history', 'utf8')
})

afterEach(async () => {
  await Promise.allSettled([
    fs.unlink(resolve(process.cwd(), './HISTORY.md')),
    fs.unlink(resolve(process.cwd(), './CHANGELOG.md'))
  ])
  process.cwd = originalCwd
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test('basic', async () => {
  vi.mocked(fetchGithubRelease).mockResolvedValueOnce(release as unknown as GitHubRelease)
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name, '--token', 'foo'])

  expect(fetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'foo'
  })
  expect(log).toHaveBeenCalledTimes(1)
  expect(log.mock.calls[0][0]).toMatchSnapshot()
  const output = resolve(process.cwd(), './CHANGELOG.md')
  expect(await isExists(output)).toBe(true)
  expect(await fs.readFile(output, 'utf8')).toBe(`${log.mock.calls[0][0]}\n`)
})

test('supports equals option syntax in published mode', async () => {
  vi.mocked(fetchGithubRelease).mockResolvedValueOnce(release as unknown as GitHubRelease)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(['--repo=kazupon/gh-changelogen', `--tag=${release.tag_name}`, '--token=equals'])

  expect(fetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'equals'
  })
})

test('keeps permissive unknown-option behavior', async () => {
  vi.mocked(fetchGithubRelease).mockResolvedValueOnce(release as unknown as GitHubRelease)
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

  expect(fetchGithubRelease).toHaveBeenCalledOnce()
})

test('resolves token as explicit, GH_TOKEN, then GITHUB_TOKEN', async () => {
  vi.stubEnv('GH_TOKEN', 'gh-token')
  vi.stubEnv('GITHUB_TOKEN', 'github-token')
  vi.mocked(fetchGithubRelease).mockResolvedValue(release as unknown as GitHubRelease)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])
  await fs.unlink(resolve(process.cwd(), './CHANGELOG.md'))
  await main([
    '--repo',
    'kazupon/gh-changelogen',
    '--tag',
    release.tag_name,
    '--token',
    'explicit-token'
  ])

  expect(fetchGithubRelease).toHaveBeenNthCalledWith(1, release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'gh-token'
  })
  expect(fetchGithubRelease).toHaveBeenNthCalledWith(2, release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'explicit-token'
  })
})

test('falls back to GITHUB_TOKEN', async () => {
  vi.stubEnv('GITHUB_TOKEN', 'github-token')
  vi.mocked(fetchGithubRelease).mockResolvedValueOnce(release as unknown as GitHubRelease)
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])

  expect(fetchGithubRelease).toHaveBeenCalledWith(release.tag_name, {
    github: 'kazupon/gh-changelogen',
    token: 'github-token'
  })
})

test('fails before requesting or writing when no token is available', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await expect(
    main(['--repo', 'kazupon/gh-changelogen', '--tag', release.tag_name])
  ).rejects.toThrow('GH_TOKEN or GITHUB_TOKEN')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(log).not.toHaveBeenCalled()
  expect(await isExists(resolve(process.cwd(), './CHANGELOG.md'))).toBe(false)
})

test('does not request or write for invalid Gunshi input', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

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
  const output = log.mock.calls.map(([message = '']) => String(message)).join('\n')
  expect(output).toContain("Optional argument '--tag' is required")
  expect(output).not.toMatch(/AggregateError|ArgsValidationError/)
  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(await fs.readFile(resolve(process.cwd(), './HISTORY.md'), 'utf8')).toBe('This is history')
  expect(await isExists(resolve(process.cwd(), './CHANGELOG.md'))).toBe(false)
})

test.each([
  ['no arguments', []],
  ['long help option', ['--help']],
  ['short help option', ['-h']],
  ['an ignored unknown option', ['--unknown', '--help']]
])('shows semantic help with %s', async (_name, args) => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await main(args)

  const output = log.mock.calls.map(([message = '']) => String(message)).join('\n')
  expect(output).toContain('USAGE:')
  expect(output).toContain('OPTIONS:')
  expect(output).toContain('-h, --help')
  for (const option of ['--repo', '--tag', '--output', '--token', '--generate-notes', '--target']) {
    expect(output.split(option)).toHaveLength(2)
  }
  expect(output).toContain('(default: CHANGELOG.md)')
  expect(output).toContain('(default: false)')
  expect(output).toContain('(default: HEAD)')
  expect(output).not.toContain('(default: GITHUB_TOKEN)')
  expect(output).toContain('-v, --version')
  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(fetchGithubGeneratedReleaseNotes).not.toHaveBeenCalled()
})

test.each(['--version', '-v'])('provides %s', async option => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await main([option])

  expect(log).toHaveBeenCalledOnce()
  expect(log).toHaveBeenCalledWith(packageJson.version)
  expect(fetchGithubRelease).not.toHaveBeenCalled()
})

test('rejects unexpected positional input', async () => {
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

test('generates notes for HEAD before a release exists', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-03T01:02:03.456Z'))
  vi.mocked(resolveGitCommitish).mockResolvedValueOnce('0123456789abcdef')
  vi.mocked(fetchGithubGeneratedReleaseNotes).mockResolvedValueOnce({
    body: '## Changes\n\n- generated',
    name: 'v1.2.3'
  })
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await main([
    '--repo=kazupon/gh-changelogen',
    '--tag=v1.2.3',
    '--token=generated-token',
    '--generate-notes'
  ])

  expect(resolveGitCommitish).toHaveBeenCalledWith('HEAD', { cwd: process.cwd() })
  expect(fetchGithubGeneratedReleaseNotes).toHaveBeenCalledWith(
    {
      repository: 'kazupon/gh-changelogen',
      tagName: 'v1.2.3',
      targetCommitish: '0123456789abcdef',
      token: 'generated-token'
    },
    expect.any(Function)
  )
  expect(log).toHaveBeenCalledOnce()
  expect(log.mock.calls[0][0]).toContain('# v1.2.3 (2026-08-03T01:02:03.456Z)')
  expect(log.mock.calls[0][0]).toContain(
    'https://github.com/kazupon/gh-changelogen/releases/tag/v1.2.3'
  )
  expect(await fs.readFile(resolve(process.cwd(), './CHANGELOG.md'), 'utf8')).toBe(
    `${log.mock.calls[0][0]}\n`
  )
})

test('resolves an explicit generated target', async () => {
  vi.mocked(resolveGitCommitish).mockResolvedValueOnce('fedcba9876543210')
  vi.mocked(fetchGithubGeneratedReleaseNotes).mockResolvedValueOnce({ body: '', name: '' })
  vi.spyOn(console, 'log').mockImplementation(() => {})

  await main([
    '--repo',
    'kazupon/gh-changelogen',
    '--tag',
    'v1.2.3',
    '--token',
    'token',
    '--generate-notes',
    '--target=main'
  ])

  expect(resolveGitCommitish).toHaveBeenCalledWith('main', { cwd: process.cwd() })
})

test('rejects an explicit target without generated mode before side effects', async () => {
  await expect(
    main([
      '--repo',
      'kazupon/gh-changelogen',
      '--tag',
      'v1.2.3',
      '--token',
      'token',
      '--target',
      'main'
    ])
  ).rejects.toThrow('--target requires --generate-notes')

  expect(fetchGithubRelease).not.toHaveBeenCalled()
  expect(resolveGitCommitish).not.toHaveBeenCalled()
  expect(await isExists(resolve(process.cwd(), './CHANGELOG.md'))).toBe(false)
})

test('does not change an existing output after a request failure', async () => {
  vi.mocked(fetchGithubRelease).mockRejectedValueOnce(new Error('fetch failed'))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await expect(
    main([
      '--repo',
      'kazupon/gh-changelogen',
      '--tag',
      release.tag_name,
      '--token',
      'foo',
      '--output',
      './HISTORY.md'
    ])
  ).rejects.toThrow('fetch failed')
  expect(log).not.toHaveBeenCalled()
  expect(await fs.readFile(resolve(process.cwd(), './HISTORY.md'), 'utf8')).toBe('This is history')
})

test('write changelog to output', async () => {
  vi.mocked(fetchGithubRelease).mockResolvedValueOnce(release as unknown as GitHubRelease)

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

  expect(await fs.readFile(resolve(process.cwd(), './HISTORY.md'), 'utf8')).toMatchSnapshot()
})
