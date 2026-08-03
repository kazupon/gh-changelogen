import { resolveGithubToken } from '../../token'

describe('resolveGithubToken', () => {
  test('prefers an explicit token', () => {
    expect(
      resolveGithubToken('explicit', {
        GH_TOKEN: 'gh-token',
        GITHUB_TOKEN: 'github-token'
      })
    ).toBe('explicit')
  })

  test('prefers GH_TOKEN over GITHUB_TOKEN', () => {
    expect(
      resolveGithubToken(undefined, {
        GH_TOKEN: 'gh-token',
        GITHUB_TOKEN: 'github-token'
      })
    ).toBe('gh-token')
  })

  test('falls back to GITHUB_TOKEN', () => {
    expect(resolveGithubToken(undefined, { GITHUB_TOKEN: 'github-token' })).toBe('github-token')
  })

  test('treats empty values as missing', () => {
    expect(
      resolveGithubToken('', {
        GH_TOKEN: '',
        GITHUB_TOKEN: 'github-token'
      })
    ).toBe('github-token')
  })

  test('reports all supported token sources without exposing values', () => {
    expect(() =>
      resolveGithubToken(undefined, {
        GH_TOKEN: '',
        GITHUB_TOKEN: ''
      })
    ).toThrow('GitHub token is required; use --token or set GH_TOKEN or GITHUB_TOKEN')
  })
})
