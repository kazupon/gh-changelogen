import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { vi } from 'vite-plus/test'

import packageJson from '../../../package.json' with { type: 'json' }
import config from '../../../bump.config'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn<typeof execFileSync>()
}))

beforeEach(() => {
  vi.mocked(execFileSync).mockReset()
})

test('builds the local CLI before running bumpp', () => {
  expect(packageJson.scripts.release).toBe('vp pack && bumpp')
})

test('generates the changelog for the version selected by bumpp', async () => {
  expect(config).toMatchObject({
    all: true,
    commit: 'release: v{version}',
    push: true,
    tag: true
  })

  const execute = config.execute
  expect(execute).toBeTypeOf('function')
  if (typeof execute !== 'function') {
    return
  }

  await execute({
    state: {
      newVersion: '2.1.0'
    }
  } as Parameters<typeof execute>[0])

  expect(execFileSync).toHaveBeenCalledWith(
    process.execPath,
    [
      fileURLToPath(new URL('../../../cli.mjs', import.meta.url)),
      '--repo=kazupon/gh-changelogen',
      '--tag=v2.1.0',
      '--generate-notes',
      '--target=HEAD',
      '--output=CHANGELOG.md'
    ],
    { stdio: 'inherit' }
  )
})
