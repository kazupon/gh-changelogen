import { generateChangelog } from '../../generator'
import release from '../fixtures/release.json'

import type { Generator, GitHubRelease } from '../../types'

describe('generateChangelog', () => {
  test('default', async () => {
    expect(await generateChangelog(release as unknown as GitHubRelease)).toMatchSnapshot()
  })

  test('custom generator', async () => {
    const myGenerator: Generator = async release => {
      return new Promise(resolve => {
        // do something ...
        setTimeout(() => resolve(`# ${release.name}`), 100)
      })
    }

    expect(await generateChangelog(release as unknown as GitHubRelease, myGenerator)).toContain(release.name)
  })

  test.todo('not compatible generator', async () => {
    // not callable generator
    const myGenerator: Generator = 'not callable' as unknown as Generator

    // assertions
    await expect(generateChangelog(release as unknown as GitHubRelease, myGenerator)).rejects.toThrow(
      'generator is not a function'
    )
  })
})
