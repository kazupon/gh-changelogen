# gh-changelogen

[![NPM downloads](https://img.shields.io/npm/dm/gh-changelogen.svg)](https://npmjs.com/package/gh-changelogen)
[![version](https://img.shields.io/npm/v/gh-changelogen/latest.svg)](https://npmjs.com/package/gh-changelogen)
[![CI](https://github.com/kazupon/gh-changelogen/actions/workflows/ci.yaml/badge.svg)](https://github.com/kazupon/gh-changelogen/actions/workflows/ci.yaml)

📜 Changelog generator for GitHub Releases

## 🌟 Features

- Generate changelog with tag from GitHub Releases

## 🚀 Usage

```sh
npx gh-changelogen --repo kazupon/gh-changelogen --tag v0.0.1 --token <your github token>
```

the below changelog is generated.

```sh
# v0.0.1 (2022-08-22T17:22:41Z)

This changelog is generated by [GitHub Releases](https://github.com/kazupon/gh-changelogen/releases/tag/v0.0.1)

<!-- Release notes generated using configuration in .github/release.yml at v0.0.1 -->

## What's Changed
### 🌟 Features
* feat: first placeholder release by @kazupon in https://github.com/kazupon/gh-changelogen/pull/3

## New Contributors
* @renovate made their first contribution in https://github.com/kazupon/gh-changelogen/pull/1
* @kazupon made their first contribution in https://github.com/kazupon/gh-changelogen/pull/3

**Full Changelog**: https://github.com/kazupon/gh-changelogen/commits/v0.0.1
```

### Options

- `--repo`: GitHub repository name, format `owner/repo` (e.g. `kazupon/gh-changelogen`)
- `--tag`: GitHub release tag (e.g. `v0.0.1`)
- `--token`: GitHub token, if you won’t specify, respect `GITHUB_TOKEN` env
- `--output`: Changelog file name to create or update. defaults to `CHANGELOG.md` and resolved relative

### In Github Actions

The following is release workflow triggered by git tag push:

```yml
# .github/workflows/release.yml

name: Release

on:
  push:
    branches-ignore:
      - '**'
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout codes
        uses: actions/checkout@v3
        with:
          ref: ${{ github.head_ref }}

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 16.x

      - name: Extract version tag
        if: startsWith( github.ref, 'refs/tags/v' )
        uses: jungwinter/split@v2
        id: split
        with:
          msg: ${{ github.ref }}
          separator: '/'

      - name: Create Github Release
        run: gh release create ${{ steps.split.outputs._2 }} --generate-notes
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate changelog
        run: npx gh-changelogen --repo=kazupon/gh-changelogen --tag=${{ steps.split.outputs._2 }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit changelog
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          branch: main
          file_pattern: '*.md'
          commit_message: 'chore: sync changelog'

      - name: Publish package
        run: npm publish
        env:
          NPM_TOKEN: ${{secrets.NPM_TOKEN}}
```

## 💪 Motivation

- GitHub Rleases is awesome, it automatically generates the changelog.
- However, not all people will see the changelog in the Github Releases UI.
- Some people prefer the text base of changelog.
- Github Releases cannot sync changelog of repo.
- So I need tool to generate Github Releases as the **single-of-truth** for changelog.

## 🙌 Contributing guidelines

If you are interested in contributing to `gh-changelogen`, I highly recommend checking out [the contributing guidelines](/CONTRIBUTING.md) here. You'll find all the relevant information such as [how to make a PR](/CONTRIBUTING.md#pull-request-guidelines), [how to setup development](/CONTRIBUTING.md#development-setup)) etc., there.

## ©️ License

[MIT](https://opensource.org/licenses/MIT)
