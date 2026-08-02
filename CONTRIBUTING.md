# Contributing Guide

- [Contributing Guide](#contributing-guide)
  - [Issue Reporting Guidelines](#issue-reporting-guidelines)
  - [Pull Request Guidelines](#pull-request-guidelines)
    - [Work Step Example](#work-step-example)
  - [Development Setup](#development-setup)
    - [Common Vite+ commands](#common-vite-commands)

## Issue Reporting Guidelines

- The issue list of this repo is **exclusively** for bug reports and feature requests. Non-conforming issues will be closed immediately.

- Try to search for your issue, it may have already been answered or even fixed in the main branch.

- Check if the issue is reproducible with the latest stable version of gh-changelogen. If you are using a pre-release, please indicate the specific version you are using.

- It is **required** that you clearly describe the steps necessary to reproduce the issue you are running into. Issues with no clear repro steps will not be triaged. If an issue labeled `status: need more repro codes or info` receives no further input from the issue author for more than 5 days, it will be closed.

- For bugs that involves build setups, you can create a reproduction repository with steps in the README.

- If your issue is resolved but still open, don’t hesitate to close it. In case you found a solution by yourself, it could be helpful to explain how you fixed it.

## Pull Request Guidelines

- Checkout a topic branch from the `main` branch.

- It's OK to have multiple small commits as you work on the PR - we will let GitHub automatically squash it before merging.

- Make sure the full validation command passes. (see [development setup](#development-setup))

- If adding new feature:

  - Add accompanying test case.
  - Provide convincing reason to add this feature. Ideally you should open a suggestion issue first and have it greenlighted before working on it.

- If fixing a bug:
  - Provide detailed description of the bug in the PR.
  - Add appropriate test coverage if applicable.

### Work Step Example

- Fork the repository from [gh-changelogen](https://github.com/kazupon/gh-changelogen) !
- Create your topic branch from `main`: `git branch my-new-topic origin/main`
- Add codes and pass tests !
- Commit your changes: `git commit -am 'Add some topic'`
- Push to the branch: `git push origin my-new-topic`
- Submit a pull request to `main` branch of `kazupon/gh-changelogen` repository !

## Development Setup

After cloning the repo, run:

```sh
vp install
```

Vite+ manages the development Node.js runtime and pnpm version declared by the project. If the setup or runtime looks wrong, run `vp env doctor` and include its output when asking for help.

### Common Vite+ commands

```sh
# Format, lint, and type-check the project
vp check

# Apply automatic formatting and lint fixes
vp check --fix

# Run the test suite
vp test

# Check for unused exports
vp run deadcode

# Build the publishable library and CLI artifacts
vp pack
```

Before submitting a pull request, run the full validation sequence:

```sh
vp check && vp test && vp run deadcode && vp pack
```

Other compatibility aliases are available in the `scripts` section of `package.json` and can be run with `vp run <script>`.

**Please make sure to have this pass successfully before submitting a PR.** Although the same tests will be run against your PR on the CI server, it is better to have it working locally beforehand.
