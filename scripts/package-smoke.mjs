import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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
    'dist/application-HASH.cjs',
    'dist/application-HASH.mjs',
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

  const packageFiles = await listFiles(packageDirectory)
  assert.deepEqual(
    packageFiles.map(normalizeBuildChunkName).sort(compareStrings),
    expectedPackageFiles
  )
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
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ['gunshi', 'semver'])
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
      "const api = await import('gh-changelogen'); const keys = Object.keys(api).sort(); if (keys.join(',') !== 'generateGithubReleaseNotes,updateChangelog') throw new Error(`unexpected ESM runtime exports: ${keys}`)"
    ],
    { cwd: consumerDirectory }
  )
  run(
    process.execPath,
    [
      '--eval',
      "const api = require('gh-changelogen'); const keys = Object.keys(api).sort(); if (keys.join(',') !== 'generateGithubReleaseNotes,updateChangelog') throw new Error(`unexpected CJS runtime exports: ${keys}`)"
    ],
    { cwd: consumerDirectory }
  )

  const apiExports = ['generateGithubReleaseNotes', 'updateChangelog']
  const esmApi = await import(pathToFileURL(join(packageDirectory, 'dist/index.mjs')).href)
  const require = createRequire(import.meta.url)
  const cjsApi = require(join(packageDirectory, 'dist/index.cjs'))
  assert.deepEqual(Object.keys(esmApi).sort(), apiExports)
  assert.deepEqual(Object.keys(cjsApi).sort(), apiExports)
  for (const name of apiExports) {
    assert.equal(typeof esmApi[name], 'function')
    assert.equal(typeof cjsApi[name], 'function')
  }

  const declarations = await readFile(join(packageDirectory, 'dist/index.d.ts'), 'utf8')
  for (const declaration of [
    'GenerateGithubReleaseNotesOptions',
    'ReleaseNotes',
    'UpdateChangelogOptions',
    'UpdateChangelogResult'
  ]) {
    assert.match(declarations, new RegExp(`(?:interface|type) ${declaration}\\b`))
  }

  const cliExports = ['isCliValidationError', 'main']
  const esmCli = await import(pathToFileURL(join(packageDirectory, 'dist/cli.mjs')).href)
  const cjsCli = require(join(packageDirectory, 'dist/cli.cjs'))
  assert.deepEqual(Object.keys(esmCli).sort(), cliExports)
  assert.deepEqual(Object.keys(cjsCli).sort(), cliExports)

  await smokeProgrammaticApi(esmApi, consumerDirectory)

  const cli = join(packageDirectory, 'cli.mjs')
  const consumerRequire = createRequire(join(consumerDirectory, 'package.json'))
  const packageEntry = consumerRequire.resolve('gh-changelogen')
  assert.equal(await realpath(resolve(dirname(packageEntry), '..', 'cli.mjs')), await realpath(cli))

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
  assert.match(help.stdout, /--token (?:<token>|\[token\])/)
  assert.match(help.stdout, /--generate-notes/)
  assert.match(help.stdout, /--target \[target\]/)
  assert.match(help.stdout, /default: CHANGELOG\.md/)
  assert.match(help.stdout, /default: false/)
  assert.match(help.stdout, /default: HEAD/)
  assert.doesNotMatch(help.stdout, /default: GITHUB_TOKEN/)
  assert.match(help.stdout, /-v, --version/)
  for (const option of ['--repo', '--tag', '--output', '--token', '--generate-notes', '--target']) {
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
    const version = run(process.execPath, [cli, option], { cwd: consumerDirectory })
    assert.equal(version.stdout, `${packageJson.version}\n`)
    assert.equal(version.stderr, '')
  }

  const missingToken = runResult(
    process.execPath,
    [cli, '--repo', 'owner/repo', '--tag', 'v0.0.0'],
    {
      cwd: consumerDirectory,
      env: { GH_TOKEN: '', GITHUB_TOKEN: '' }
    }
  )
  assert.equal(missingToken.status, 1)
  assert.equal(missingToken.stdout, '')
  assert.match(missingToken.stderr, /GH_TOKEN or GITHUB_TOKEN/)
  assert.equal(countOccurrences(missingToken.stderr, 'GH_TOKEN or GITHUB_TOKEN'), 1)

  const targetWithoutGeneratedMode = runResult(
    process.execPath,
    [cli, '--repo', 'owner/repo', '--tag', 'v0.0.0', '--token', 'test', '--target', 'HEAD'],
    { cwd: consumerDirectory }
  )
  assert.equal(targetWithoutGeneratedMode.status, 1)
  assert.equal(targetWithoutGeneratedMode.stdout, '')
  assert.match(targetWithoutGeneratedMode.stderr, /--target requires --generate-notes/)

  console.log(`Package smoke test passed on ${process.version}`)
} finally {
  await rm(consumerDirectory, { recursive: true, force: true })
}

async function smokeProgrammaticApi(api, consumerDirectory) {
  run('git', ['init', '--initial-branch=main'], { cwd: consumerDirectory })
  run('git', ['config', 'user.email', 'test@example.com'], { cwd: consumerDirectory })
  run('git', ['config', 'user.name', 'Test User'], { cwd: consumerDirectory })
  run('git', ['add', 'package.json'], { cwd: consumerDirectory })
  run('git', ['commit', '-m', 'initial'], { cwd: consumerDirectory })
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: consumerDirectory }).stdout.trim()

  const originalCwd = process.cwd()
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (input, init = {}) => {
    const inputUrl =
      input instanceof Request ? input.url : input instanceof URL ? input.href : String(input)
    requests.push({ input: inputUrl, init })
    if (init.method === 'POST') {
      return Response.json({ body: '## Generated notes', name: 'v1.1.0' })
    }
    return Response.json({
      body: '## Published notes',
      html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
      name: 'v1.0.0',
      published_at: '2026-08-01T00:00:00.000Z',
      tag_name: 'v1.0.0'
    })
  }

  try {
    process.chdir(consumerDirectory)
    const published = await api.updateChangelog({
      output: 'PUBLISHED.md',
      repository: 'owner/repo',
      tagName: 'v1.0.0',
      token: 'test-token'
    })
    assert.equal(published.action, 'created')
    assert.match(await readFile(join(consumerDirectory, 'PUBLISHED.md'), 'utf8'), /Published notes/)

    const generated = await api.generateGithubReleaseNotes({
      repository: 'owner/repo',
      tagName: 'v1.1.0',
      token: 'test-token'
    })
    assert.equal(generated.source, 'generated-notes')
    assert.equal(generated.targetCommitish, head)
    assert.equal(generated.body, '## Generated notes')
  } finally {
    globalThis.fetch = originalFetch
    process.chdir(originalCwd)
  }

  assert.equal(requests.length, 2)
  assert.equal(requests[0].init.method, 'GET')
  assert.equal(requests[1].init.method, 'POST')
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    tag_name: 'v1.1.0',
    target_commitish: head
  })
  assert.equal(requests[1].init.redirect, 'error')
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

  return files.sort(compareStrings)
}

function normalizeBuildChunkName(file) {
  return file.replace(/^dist\/application-[^.]+\.(cjs|mjs)$/u, 'dist/application-HASH.$1')
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}
