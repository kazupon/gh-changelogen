import { readFile } from 'node:fs/promises'

let workflow: string

beforeAll(async () => {
  workflow = await readFile(
    new URL('../../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  )
})

test('creates the GitHub Release from the pushed tag', () => {
  expect(workflow).toContain('name: Create GitHub Release')
  expect(workflow).toContain('ref: ${{ env.TAG }}')
  expect(workflow).toContain('gh release create "$TAG" --generate-notes')
})

test('does not update the changelog after publication', () => {
  expect(workflow).not.toContain('Sync changelog from GitHub Releases')
  expect(workflow).not.toContain('git-auto-commit-action')
  expect(workflow).not.toContain('file_pattern: CHANGELOG.md')
})
