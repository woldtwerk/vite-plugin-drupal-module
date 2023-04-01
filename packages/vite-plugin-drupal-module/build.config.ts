import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  clean: true,
  declaration: true,
  externals: [
    'esbuild',
    'vite',
    'rollup',
    'unplugin-vue-components',
    '@vitejs/plugin-vue',
  ],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
