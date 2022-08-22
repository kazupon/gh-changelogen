import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: ['src/index', 'src/cli'],
  rollup: {
    emitCJS: true
  }
})
