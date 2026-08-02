import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageSpec = process.argv[2]

if (!packageSpec) {
  throw new Error('Usage: node scripts/package-smoke.mjs <package.tgz>')
}

const tarball = resolve(packageSpec)
await access(tarball, constants.R_OK)

const consumerDirectory = await mkdtemp(join(tmpdir(), 'gh-changelogen-package-smoke-'))

try {
  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'gh-changelogen-package-smoke', private: true, type: 'module' })
  )

  run(
    'npm',
    [
      'install',
      '--production',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarball
    ],
    {
      cwd: consumerDirectory
    }
  )

  const packageDirectory = join(consumerDirectory, 'node_modules', 'gh-changelogen')
  const packageJson = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'))
  const expectedFiles = [
    'dist/index.mjs',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/cli.mjs',
    'dist/cli.cjs',
    'dist/cli.d.ts'
  ]

  await Promise.all(expectedFiles.map(file => access(join(packageDirectory, file), constants.R_OK)))

  assert.deepEqual(packageJson.exports['.'], {
    types: './dist/index.d.ts',
    require: './dist/index.cjs',
    import: './dist/index.mjs'
  })
  assert.equal(packageJson.bin, './cli.mjs')

  if (process.platform !== 'win32') {
    const wrapper = await stat(join(packageDirectory, 'cli.mjs'))
    assert.notEqual(wrapper.mode & 0o111, 0, 'cli.mjs must remain executable')
  }

  run(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "const api = await import('gh-changelogen'); if (Object.keys(api).length !== 0) throw new Error('unexpected ESM runtime exports')"
    ],
    { cwd: consumerDirectory }
  )
  run(
    process.execPath,
    [
      '--eval',
      "const api = require('gh-changelogen'); if (Object.keys(api).length !== 0) throw new Error('unexpected CJS runtime exports')"
    ],
    { cwd: consumerDirectory }
  )

  const help = run(process.execPath, [join(packageDirectory, 'cli.mjs')], {
    cwd: consumerDirectory
  })
  assert.match(help.stdout, /OPTIONS:/)
  assert.match(help.stdout, /--repo <string>/)
  assert.match(help.stdout, /--tag <string>/)

  console.log(`Package smoke test passed on ${process.version}`)
} finally {
  await rm(consumerDirectory, { recursive: true, force: true })
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_update_notifier: 'false'
    }
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed (${result.status}): ${command} ${args.join(' ')}`,
        result.stdout,
        result.stderr
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  return result
}
