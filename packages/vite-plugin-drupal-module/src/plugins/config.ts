import { basename, dirname, relative, resolve } from 'node:path'
import type { Plugin, UserConfigExport } from 'vite'
import { mergeConfig } from 'vite'
import fg from 'fast-glob'
import type { Context } from './context'

export default (ctx: Context): Plugin => {
  const assetMap = new Map<string, string>()
  const hash = ctx.options.version === 'hash'
    ? '.[hash]'
    : ''

  return {
    name: 'vite-plugin-drupal-module--config',
    async config(config) {
      return mergeConfig(config, <UserConfigExport>{
        base: './',
        resolve: {
          alias: {
            '~/': `${resolve(process.cwd())}/`,
          },
        },
        copyPublicDir: false,
        build: {
          target: 'esnext',
          manifest: ctx.options.version === 'hash',
          copyPublicDir: false,
          rollupOptions: {
            input: await fg([
              '(js|css)/**/*.(js|jsx|ts|tsx|css|scss|pcss)',
            ], {
              onlyFiles: true,
              ignore: ['**/*.stories.*', '**/*.ce.*', '**/_*', '**/*.d.ts'],
            }),
            output: {
              assetFileNames: (assetInfo: any) => {
                const base = basename(assetInfo.name)
                let dir = dirname(assetInfo.name)

                if (assetMap.has(base))
                  return assetMap.get(base)

                dir = dir.startsWith('.') ? '' : `${dir}/`
                assetMap.set(base, `${dir}[name]${hash}.[ext]`)

                return `[name]${hash}.[ext]`
              },
              entryFileNames: (assetInfo) => {
                if (assetInfo.facadeModuleId?.match(/.(ts|js|tsx|jsx|css)$/)) {
                  const base = dirname(relative('./', assetInfo.facadeModuleId))
                  return `${base}/[name]${hash}.js`
                }
                return `[name]${hash}.js`
              },
            },
          },
        },
      })
    },
  }
}
