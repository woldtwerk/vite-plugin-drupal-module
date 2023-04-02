import Path from 'node:path'
import fs from 'node:fs/promises'
import path from 'node:path'
import defu from 'defu'
import YAML from 'yaml'
import type { Plugin } from 'vite'
import type { Context } from './context'

export interface DrupalLibrary {
  version?: string
  header?: boolean
  dependencies?: string[]
  js?: JSPart
  css?: {
    [key in CSSGroup]: CSSPart
  }
}

export interface JSPart {
  [key: string]: {
    type?: 'external' | 'file'
    minified?: boolean
    preprocessed?: boolean
    attributes?: {
      defer?: boolean
      type?: 'module' | string
      crossorigin?: string
      [key: string]: any
    }
    preprocess?: boolean
  }
}

export const cssGroups = ['base', 'layout', 'component', 'state', 'theme'] as const
export type CSSGroup = typeof cssGroups[number]

export interface CSSPart {
  [key: string]: {
    group?: number
    type?: 'external' | 'file'
    weight?: number
    media?: string
    preprocess?: boolean
    attributes?: Record<string, any>
  }
}

export default (ctx: Context): Plugin => {
  const depMap = new Map<string, Set<string>>()

  return {
    name: 'vite-plugin-drupal-module--library',
    enforce: 'post',
    generateBundle(_, bundle, isWrite) {
      if (!isWrite || ctx.dev)
        return

      const files = Object.values(bundle)
        .filter(
          assetOrChunk =>
            assetOrChunk.type === 'asset' || (assetOrChunk.type === 'chunk' && assetOrChunk.code !== '\n' && assetOrChunk.isDynamicEntry === false && !assetOrChunk.fileName.match(/^asset/)),
        )
        .map(assetOrChunk => assetOrChunk.fileName)

      files.forEach((file) => {
        const code = 'code' in bundle[file] ? (bundle[file] as any).code : ''
        setDeps(file, code, depMap)
      })

      const libraries = buildLib(files, ctx, depMap)

      emitLib(libraries, ctx)
    },
    async buildStart() {
      if (!ctx.dev)
        return

      const files = ctx.resoledConfig.build.rollupOptions.input as string[]

      await Promise.allSettled(files.filter(file => file.match(/\.(jsx?|tsx?|vue|svelte)$/)).map(async (file) => {
        const code = await (await fs.readFile(file, 'utf-8')).toString()
        setDeps(file, code, depMap)
      }))

      const libraries = buildLib(files, ctx, depMap)

      /**
       * Add Vite client in dev.
       */
      ctx.dev && Object.assign(libraries, {
        vite: {
          header: true,
          js: {
            [`${ctx.url}/@vite/client`]: {
              type: 'external',
              attributes: { type: 'module' },
            },
          },
        },
      })
      emitLib(libraries, ctx)
    },
    async transformIndexHtml(html) {
      const corePath = 'vendor/drupal/core'
      const coreLibrariesPath = path.resolve(process.cwd(), corePath, 'core.libraries.yml')
      const claroLibraries = await fs.readFile(coreLibrariesPath, 'utf-8')
      const coreLibrariesParsed = YAML.parse(claroLibraries)

      const deps = new Set(Array.from(depMap.values())
        .flatMap(value => Array.from(value))
        .map(value => value.replace(/^core\//, '')))

      const drupalDeps = Array.from(deps)
        .flatMap((val) => {
          const lib = <DrupalLibrary>coreLibrariesParsed[val]
          return [
            cssGroups.flatMap(group => Object.keys(lib.css?.[group] ?? {}))
              .map(val => `<link rel="stylesheet" href="/${corePath}/${val}">`),
            (Object.keys(lib.js ?? {}) ?? [])
              .map(val => `<script type="text/javascript" src="/${corePath}/${val}"></script>`),
          ].flat()
        })
        .join('')

      return html.replace('</head>', `${drupalDeps}</head>`)
    },
  }
}

/**
 * Determine CSS group based on filename.
 * @param filename filename
 * @returns css group
 */
function getCssGroup(filename: string): CSSGroup {
  if (filename.match(/\.layout$/))
    return 'layout'
  if (filename.match(/\.component$/))
    return 'component'
  if (filename.match(/\.theme$/))
    return 'theme'
  if (filename.match(/\.state$/))
    return 'state'
  return 'base'
}

/**
 * Generate CSS portion of library.
 * @param file filepath
 * @param ctx Plugin Context
 * @returns CSS portion of Drupal Library object
 */
function getCssPart(file: string, ctx: Context): DrupalLibrary {
  const group = getCssGroup(file)
  const assetPath = ctx.dev
    ? `${ctx.url}/${file}`
    : `${ctx.resoledConfig.build.outDir}/${file}`

  return <DrupalLibrary>{
    css: {
      [group]: {
        [assetPath]: {
          type: ctx.dev ? 'external' : 'file',
          ...(ctx.options.version === 'hash' && {
            preprocessed: true,
          }),
        },
      },
    },
  }
}

/**
 * Generate JS portion of library.
 * @param file filepath
 * @param ctx Plugin Context
 * @returns JS portion of Drupal Library object
 */
function getJsPart(file: string, ctx: Context): DrupalLibrary {
  const assetPath = ctx.dev
    ? `${ctx.url}/${file}`
    : `${ctx.resoledConfig.build.outDir}/${file}`

  return <DrupalLibrary> {
    js: {
      [assetPath]: {
        type: ctx.dev ? 'external' : 'file',
        ...(ctx.options.version === 'hash' && {
          preprocessed: true,
        }),
        minified: true,
        attributes: { type: 'module', crossorigin: {} },
      },
    },
  }
}

/**
 * Build library.
 * @param files Rollup Input files
 * @param ctx Plugin Context
 * @param deps Drupal Dependencies Map
 * @returns Drupal Library object
 */
function buildLib(files: string[], ctx: Context, deps: Map<string, Set<string>>): Record<string, DrupalLibrary> {
  const libraries: Record<string, DrupalLibrary> = {}

  files
    .forEach((file) => {
      let { name } = Path.parse(file)
      const ext = Path.parse(file).ext.replace('.', '')

      if (ext === 'css') {
        const part = getCssPart(getLibID(file, ctx), ctx)
        name = name.replace(/\.(base|layout|component|state|theme)$/, '')
        libraries[name] = defu(part, libraries[name] ?? {})
      }
      else {
        const part = getJsPart(getLibID(file, ctx), ctx)
        libraries[name] = defu(part, libraries[name] ?? {})
      }

      if (ctx.options.version === 'drupal')
        libraries[name].version = 'VERSION'
      if (ctx.options.version === 'module')
        libraries[name].version = ctx.moduleVersion
      if (deps.has(file)) {
        const dependencies = libraries[name].dependencies ?? []
        libraries[name].dependencies = Array.from(
          new Set([...dependencies, ...Array.from(deps.get(file) ?? [])]),
        )
      }
    })
  return libraries
}

/**
 * Write Libraries to file.
 * @param libraries Libraries object
 * @param ctx Plugin Context
 */
async function emitLib(libraries: Record<string, DrupalLibrary>, ctx: Context) {
  let pre = ''
  try {
    const contents = await (await fs.readFile(`${ctx.moduleName}.libraries.yml`)).toString()
    pre = `${contents.split('# vite generated').at(0)?.trim() || ''}\n# vite generated\n`
  }
  catch {}

  const source = `${pre}${
      YAML.stringify(libraries)}`

  await fs.writeFile(`${ctx.moduleName}.libraries.yml`, source)
}

/**
 * Return library ID.
 * @param file file path
 * @param ctx Plugin Context
 * @returns sanitized library ID
 */
function getLibID(file: string, ctx: Context) {
  if (ctx.prod && ctx.options.version === 'hash') {
    const hash = file.match(/\.([a-f0-9]{8})\./)?.at(1)
    if (hash)
      file = file.replace(/\.([a-f0-9]{8})\./, '.')
  }
  return file
}

const deps = [
  [/once\(/, 'core/once'],
  [/Drupal\./, 'core/drupal'],
  [/drupalSettings\./, 'core/drupalSettings'],
  [/Drupal\.debounce/, 'core/drupal.debounce'],
  [/Drupal\.displace/, 'core/drupal.displace'],
  [/Drupal\.announce/, 'core/drupal.announce'],
  [/Drupal\.Message/, 'core/drupal.message'],
  [/Cookies\./, 'core/js-cookie'],
] as const

/**
 * Scan code for drupal dependencies.
 * @param file file path
 * @param code code
 * @param depMap dependency map
 */
function setDeps(file: string, code: string, depMap: Map<string, Set<string>>) {
  deps.forEach(([regex, library]) => {
    if (code.match(regex)) {
      const dep = depMap.get(file)
      depMap.set(file, dep ? dep.add(library) : new Set([library]))
    }
  })
}
