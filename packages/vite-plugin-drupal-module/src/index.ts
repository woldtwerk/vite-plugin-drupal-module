import type { Plugin } from 'vite'
import { isPackageExists } from 'local-pkg'
import Unimport from 'unimport/unplugin'
import type { Context } from './plugins/context'
import context from './plugins/context'
import config from './plugins/config'
import library from './plugins/library'
import theme from './plugins/theme'
import type { UserOptions } from './types'

export default async (options: UserOptions = {}): Promise<Plugin[]> => {
  const ctx = <Context>{}

  const UnimportPlugin = 'default' in Unimport
    ? Unimport.default as typeof Unimport
    : Unimport

  const plugins = [
    await context(ctx, options),
    config(ctx),
    library(ctx),
    await theme(ctx),
    UnimportPlugin.vite(ctx.options.unimport || {}),
    ...await addOptionalPlugin(ctx),
  ].flat()

  return plugins
}

async function addOptionalPlugin(ctx: Context): Promise<Plugin[]> {
  const optionalPlugins = []

  if (isPackageExists('vue', { paths: [process.cwd()] })) {
    try {
      const { default: Components } = await import('unplugin-vue-components/vite')
      optionalPlugins.push(Components(ctx.options.components || {}))
    }
    catch (_) {
      console.error('Couldn\'t find unplugin-vue-components. Please install it with `pnpm i -D unplugin-vue-components`')
    }

    try {
      const { default: Vue } = await import('@vitejs/plugin-vue')
      optionalPlugins.push(Vue(ctx.options.vue || {}))
    }
    catch (_) {
      console.error('Couldn\'t find @vitejs/plugin-vue. Please install it with `pnpm i -D @vitejs/plugin-vue`')
    }
  }
  return optionalPlugins
}
