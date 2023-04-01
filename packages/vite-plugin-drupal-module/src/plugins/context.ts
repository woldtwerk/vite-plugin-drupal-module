import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ResolvedConfig, UserConfig } from 'vite'
import fg from 'fast-glob'
import { defu } from 'defu'
import type { UserOptions } from '../types'
import LocalComponentResolver from '../importResolver'

export interface Context {
  moduleName: string
  moduleVersion: string
  config: UserConfig
  resoledConfig: ResolvedConfig
  dev: boolean
  prod: boolean
  options: UserOptions
  port: number
  url: string
}

const defaultOptions: UserOptions = {
  version: 'module',
  unimport: {
    dts: '.drupal/unimport.d.ts',
    dirs: [
      './js',
    ],
  },
  components: {
    dts: '.drupal/components.d.ts',
    resolvers: [
      LocalComponentResolver(),
    ],
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag: string) => tag.includes('-'),
      },
    },
  },
}

export default async (ctx: Context, options: UserOptions): Promise<Plugin> => {
  ctx.moduleName = await getModuleName()
  ctx.options = defu(options, defaultOptions)
  ctx.port = 5173
  ctx.url = `http://localhost:${ctx.port}`

  const packageJsonPath = path.resolve('./package.json')

  try {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    ctx.moduleVersion = pkg.version
  }
  catch {
    console.warn('Couldn\'t find package.json file.')
  }

  return {
    name: 'vite-plugin-drupal-module--context',
    enforce: 'pre',
    config(config) {
      ctx.config = config
    },
    configResolved(config) {
      ctx.dev = config.mode === 'development'
      ctx.prod = !ctx.dev
      ctx.resoledConfig = config
    },
  }
}

/**
 * Read Module name from .info.yml file.
 * @returns Promise<string> The name of the module.
 */
async function getModuleName(): Promise<string> {
  const infoYml = await fg([
    '*.info.yml',
  ], {
    onlyFiles: true,
    deep: 1,
    cwd: process.cwd(),
  })

  if (!infoYml.length)
    throw new Error('No .info.yml file found in the current directory.')

  return infoYml[0].replace(/\.info\.yml$/, '')
}
