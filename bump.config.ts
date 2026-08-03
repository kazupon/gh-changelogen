/// <reference types="node" />

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'bumpp'

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url))

export default defineConfig({
  all: true,
  commit: 'release: v{version}',
  execute: operation => {
    execFileSync(
      process.execPath,
      [
        cli,
        '--repo=kazupon/gh-changelogen',
        `--tag=v${operation.state.newVersion}`,
        '--generate-notes',
        '--target=HEAD',
        '--output=CHANGELOG.md'
      ],
      { stdio: 'inherit' }
    )
  },
  push: true,
  tag: true
})
