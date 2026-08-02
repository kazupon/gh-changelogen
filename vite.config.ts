import {
  defaultIgnoreFilesOfEnforceHeaderCommentRule,
  defineFmtConfig,
  defineLintConfig
} from '@kazupon/vp-config'
import { defineConfig } from 'vite-plus'

const externalDependencies = ['ohmyfetch', 'semver', 'zod', 'zodiarg']

export default defineConfig({
  staged: {
    '*': 'vp check --fix'
  },
  test: {
    globals: true,
    clearMocks: true
  },
  pack: {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts'
    },
    dts: true,
    format: ['esm', 'cjs'],
    platform: 'node',
    target: 'node14.18',
    fixedExtension: true,
    outExtensions: ({ format }) => ({
      js: format === 'cjs' ? '.cjs' : '.mjs',
      dts: '.d.ts'
    }),
    clean: true
  },
  // gh-changelogen is packaged with `vp pack`; this keeps `vp build` useful as
  // a non-writing Vite bundle validation without replacing the publish output.
  build: {
    write: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        cli: 'src/cli.ts'
      },
      formats: ['es', 'cjs']
    },
    rolldownOptions: {
      external: [/^node:/, ...externalDependencies]
    }
  },
  fmt: defineFmtConfig({
    ignorePatterns: [
      'CHANGELOG.md',
      'CODE_OF_CONDUCT.md',
      'README.md',
      'dist/**',
      'coverage/**',
      'src/__tests__/fixtures/output/**',
      '**/__snapshots__/**'
    ]
  }),
  lint: defineLintConfig({
    ignorePatterns: ['dist/**', 'coverage/**', 'src/__tests__/fixtures/output/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error'
    },
    comments: {
      enForceHeaderComment: {
        ignoreFiles: [
          ...defaultIgnoreFilesOfEnforceHeaderCommentRule,
          'cli.mjs',
          'scripts/**',
          'src/**'
        ]
      }
    }
  })
})
