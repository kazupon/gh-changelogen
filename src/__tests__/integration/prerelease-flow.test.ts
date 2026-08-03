import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { updateChangelogWithDependencies } from '../../application'

import type { IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

interface RecordedRequest {
  body: {
    tag_name: string
    target_commitish: string
  }
  headers: IncomingHttpHeaders
  method?: string
  url?: string
}

test('includes a prerelease changelog in the release commit and tag', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'gh-changelogen-release-flow-'))
  const requests: RecordedRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      requests.push({
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        headers: request.headers,
        method: request.method,
        url: request.url
      })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          body: '## Changes\n\n- Feature generated before the release commit.',
          name: 'v1.1.0'
        })
      )
    })
  })

  try {
    git(repository, ['init', '--initial-branch=main'])
    git(repository, ['config', 'user.email', 'test@example.com'])
    git(repository, ['config', 'user.name', 'Test User'])
    await writeFile(join(repository, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n')
    await writeFile(
      join(repository, 'CHANGELOG.md'),
      '# v1.0.0 (2026-07-01T00:00:00.000Z)\n\nExisting notes.\n'
    )
    git(repository, ['add', 'package.json', 'CHANGELOG.md'])
    git(repository, ['commit', '-m', 'initial release'])
    git(repository, ['tag', 'v1.0.0'])
    const targetBeforeRelease = git(repository, ['rev-parse', 'HEAD'])

    await writeFile(join(repository, 'package.json'), '{"name":"fixture","version":"1.1.0"}\n')

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address() as AddressInfo
    const mockApi = new URL(`http://127.0.0.1:${address.port}`)
    const proxyFetch: typeof fetch = (input, init) => {
      const originalUrl = new URL(input instanceof Request ? input.url : input.toString())
      const localUrl = new URL(`${originalUrl.pathname}${originalUrl.search}`, mockApi)
      return globalThis.fetch(localUrl, init)
    }
    const dependencies = {
      clock: () => new Date('2026-08-03T01:02:03.456Z'),
      cwd: () => repository,
      fetch: proxyFetch
    }

    const first = await updateChangelogWithDependencies(
      {
        repository: 'owner/repo',
        source: 'generated-notes',
        tagName: 'v1.1.0',
        token: 'test-token'
      },
      dependencies
    )
    const second = await updateChangelogWithDependencies(
      {
        repository: 'owner/repo',
        source: 'generated-notes',
        tagName: 'v1.1.0',
        token: 'test-token'
      },
      dependencies
    )

    expect(first.action).toBe('prepended')
    expect(second.action).toBe('unchanged')
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      body: {
        tag_name: 'v1.1.0',
        target_commitish: targetBeforeRelease
      },
      method: 'POST',
      url: '/repos/owner/repo/releases/generate-notes'
    })
    expect(requests[0].headers).toMatchObject({
      accept: 'application/vnd.github+json',
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28'
    })

    const changelog = await readFile(join(repository, 'CHANGELOG.md'), 'utf8')
    expect(changelog.split('https://github.com/owner/repo/releases/tag/v1.1.0')).toHaveLength(2)
    expect(changelog).toContain('Feature generated before the release commit.')

    git(repository, ['add', 'package.json', 'CHANGELOG.md'])
    git(repository, ['commit', '-m', 'release: v1.1.0'])
    git(repository, ['tag', 'v1.1.0'])
    const releaseCommit = git(repository, ['rev-parse', 'HEAD'])

    expect(releaseCommit).not.toBe(targetBeforeRelease)
    expect(git(repository, ['rev-parse', 'v1.1.0^{commit}'])).toBe(releaseCommit)
    expect(git(repository, ['show', 'v1.1.0:package.json'])).toContain('"version":"1.1.0"')
    expect(git(repository, ['show', 'v1.1.0:CHANGELOG.md'])).toContain(
      'https://github.com/owner/repo/releases/tag/v1.1.0'
    )
    expect(git(repository, ['status', '--porcelain'])).toBe('')
  } finally {
    if (server.listening) {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
    await rm(repository, { force: true, recursive: true })
  }
})

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}
