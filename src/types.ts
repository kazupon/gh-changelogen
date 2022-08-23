export type GitHubRelease = {
  name: string
  tagName: string
  url: string
  publishedAt: string
  body: string
}

export type Generator = (release: GitHubRelease) => Promise<string>
export type Fetcher = (tag: string) => Promise<GitHubRelease>

export interface Plugin {
  fetcher?: Fetcher
  generator?: Generator
}
