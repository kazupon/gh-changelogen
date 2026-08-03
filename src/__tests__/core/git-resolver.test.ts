import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveGitCommitish } from '../../git'

let repository: string
let head: string

beforeEach(async () => {
  repository = await mkdtemp(join(tmpdir(), 'gh-changelogen-git-'))
  git(['init', '--initial-branch=main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test User'])
  await writeFile(join(repository, 'file.txt'), 'initial\n')
  git(['add', 'file.txt'])
  git(['commit', '-m', 'initial'])
  git(['tag', 'lightweight'])
  git(['tag', '-a', 'annotated', '-m', 'annotated tag'])
  head = git(['rev-parse', 'HEAD'])
})

afterEach(async () => {
  await rm(repository, { force: true, recursive: true })
})

test.each(['HEAD', 'main', 'lightweight', 'annotated'])(
  'resolves %s to a commit SHA',
  async ref => {
    await expect(resolveGitCommitish(ref, { cwd: repository })).resolves.toBe(head)
  }
)

test('accepts a full commit SHA', async () => {
  await expect(resolveGitCommitish(head, { cwd: repository })).resolves.toBe(head)
})

test('uses HEAD by default', async () => {
  await expect(resolveGitCommitish(undefined, { cwd: repository })).resolves.toBe(head)
})

test('rejects a tree object', async () => {
  const tree = git(['rev-parse', 'HEAD^{tree}'])
  await expect(resolveGitCommitish(tree, { cwd: repository })).rejects.toThrow(
    'does not resolve to a commit'
  )
})

test('rejects a blob object', async () => {
  const blob = git(['rev-parse', 'HEAD:file.txt'])
  await expect(resolveGitCommitish(blob, { cwd: repository })).rejects.toThrow(
    'does not resolve to a commit'
  )
})

test('rejects an option-looking commitish without treating it as a Git option', async () => {
  await expect(resolveGitCommitish('--help', { cwd: repository })).rejects.toThrow(
    'Git commitish "--help" does not resolve to a commit'
  )
})

test('rejects an unknown ref', async () => {
  await expect(resolveGitCommitish('missing', { cwd: repository })).rejects.toThrow(
    'does not resolve to a commit'
  )
})

test('reports a directory outside a Git repository', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'gh-changelogen-outside-git-'))
  try {
    await expect(resolveGitCommitish('HEAD', { cwd: outside })).rejects.toThrow(
      'outside a Git repository'
    )
  } finally {
    await rm(outside, { force: true, recursive: true })
  }
})

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8'
  }).trim()
}
