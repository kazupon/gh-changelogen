import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
  const expectedPackageFiles = [
    'LICENSE',
    'README.md',
    'cli.mjs',
    'dist/cli.cjs',
    'dist/cli.d.ts',
    'dist/cli.mjs',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.mjs',
    'package.json'
  ]
  const expectedBuildFiles = [
    'dist/index.mjs',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/cli.mjs',
    'dist/cli.cjs',
    'dist/cli.d.ts'
  ]

  assert.deepEqual(await listFiles(packageDirectory), expectedPackageFiles)
  await Promise.all(
    expectedBuildFiles.map(file => access(join(packageDirectory, file), constants.R_OK))
  )

  assert.deepEqual(packageJson.exports['.'], {
    types: './dist/index.d.ts',
    require: './dist/index.cjs',
    import: './dist/index.mjs'
  })
  assert.equal(packageJson.bin, './cli.mjs')
  assert.equal(packageJson.engines.node, '>= 22')
  assert.equal(packageJson.dependencies.ohmyfetch, undefined)
  assert.equal(packageJson.dependencies.zod, undefined)
  assert.equal(packageJson.dependencies.zodiarg, undefined)
  assert.match(packageJson.dependencies.gunshi, /^\^\d+\.\d+\.\d+$/)
  assert.equal(packageJson.dependencies['@gunshi/docs'], undefined)
  assert.equal(packageJson.devDependencies['@gunshi/docs'], packageJson.dependencies.gunshi)

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

  const cliExports = ['isCliValidationError', 'main']
  const esmCli = await import(pathToFileURL(join(packageDirectory, 'dist/cli.mjs')).href)
  const require = createRequire(import.meta.url)
  const cjsCli = require(join(packageDirectory, 'dist/cli.cjs'))
  assert.deepEqual(Object.keys(esmCli).sort(), cliExports)
  assert.deepEqual(Object.keys(cjsCli).sort(), cliExports)

  const cli = join(packageDirectory, 'cli.mjs')
  const help = run(process.execPath, [cli], {
    cwd: consumerDirectory
  })
  const longHelp = run(process.execPath, [cli, '--help'], {
    cwd: consumerDirectory
  })
  const shortHelp = run(process.execPath, [cli, '-h'], {
    cwd: consumerDirectory
  })
  const helpWithUnknownOption = run(process.execPath, [cli, '--unknown', '--help'], {
    cwd: consumerDirectory
  })

  assert.equal(help.stderr, '')
  assert.equal(help.stdout, longHelp.stdout)
  assert.equal(help.stdout, shortHelp.stdout)
  assert.equal(help.stdout, helpWithUnknownOption.stdout)
  assert.match(help.stdout, /USAGE:/)
  assert.match(help.stdout, /OPTIONS:/)
  assert.match(help.stdout, /-h, --help/)
  assert.match(help.stdout, /--repo <repo>/)
  assert.match(help.stdout, /--tag <tag>/)
  assert.match(help.stdout, /--output \[output\]/)
  assert.match(help.stdout, /--token \[token\]/)
  assert.match(help.stdout, /default: CHANGELOG\.md/)
  assert.match(help.stdout, /default: GITHUB_TOKEN/)
  assert.doesNotMatch(help.stdout, /--version/)
  for (const option of ['--repo', '--tag', '--output', '--token']) {
    assert.equal(countOccurrences(help.stdout, option), 1, `${option} should appear once in help`)
  }

  const missingRepo = runResult(process.execPath, [cli, '--tag', 'v0.0.0', '--token', 'test'], {
    cwd: consumerDirectory
  })
  assert.equal(missingRepo.status, 1)
  assert.equal(missingRepo.stderr, '')
  assert.match(missingRepo.stdout, /Optional argument '--repo' is required/)
  assert.equal(countOccurrences(missingRepo.stdout, "Optional argument '--repo' is required"), 1)
  assert.doesNotMatch(missingRepo.stdout, /AggregateError|ArgsValidationError|\n\s+at /)

  const missingTag = runResult(process.execPath, [cli, '--repo', 'owner/repo', '--token', 'test'], {
    cwd: consumerDirectory
  })
  assert.equal(missingTag.status, 1)
  assert.equal(missingTag.stderr, '')
  assert.match(missingTag.stdout, /Optional argument '--tag' is required/)
  assert.equal(countOccurrences(missingTag.stdout, "Optional argument '--tag' is required"), 1)
  assert.doesNotMatch(missingTag.stdout, /AggregateError|ArgsValidationError|\n\s+at /)

  for (const option of ['--version', '-v']) {
    const version = runResult(process.execPath, [cli, option], { cwd: consumerDirectory })
    assert.equal(version.status, 1)
    assert.equal(version.stdout, '')
    assert.match(version.stderr, new RegExp(`Unknown option: ${option}`))
    assert.doesNotMatch(version.stderr, /^unknown$/m)
  }

  const missingToken = runResult(
    process.execPath,
    [cli, '--repo', 'owner/repo', '--tag', 'v0.0.0'],
    {
      cwd: consumerDirectory,
      env: { GITHUB_TOKEN: '' }
    }
  )
  assert.equal(missingToken.status, 1)
  assert.equal(missingToken.stdout, '')
  assert.match(missingToken.stderr, /Not found GITHUB_TOKEN in env/)
  assert.equal(countOccurrences(missingToken.stderr, 'Not found GITHUB_TOKEN in env'), 1)

  console.log(`Package smoke test passed on ${process.version}`)
} finally {
  await rm(consumerDirectory, { recursive: true, force: true })
}

function run(command, args, options) {
  const result = runResult(command, args, options)

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

function runResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
      npm_config_update_notifier: 'false'
    }
  })

  if (result.error) {
    throw result.error
  }

  return result
}

function countOccurrences(value, search) {
  return value.split(search).length - 1
}

async function listFiles(directory, prefix = '') {
  const files = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), relativePath)))
    } else {
      files.push(relativePath)
    }
  }

  return files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
