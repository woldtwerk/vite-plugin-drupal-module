import fs from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import type { Plugin } from 'vite'
import type { Context } from './context'
import type { DrupalLibrary } from './library'
import { cssGroups } from './library'

export default async (_ctx: Context): Promise<Plugin> => {
  const claroCss = await getClaroCss()

  return {
    name: 'vite-plugin-drupal-module--theme',
    transformIndexHtml(html) {
      if (!html.match(/theme="claro"/))
        return html

      return html.replace('</head>', `${claroCss}</head>`)
    },
  }
}

async function getClaroCss() {
  const claroPath = 'vendor/drupal/core/themes/claro'
  const claroLibrariesPath = path.resolve(process.cwd(), claroPath, 'claro.libraries.yml')
  const claroLibraries = await fs.readFile(claroLibrariesPath, 'utf-8')
  const claroLibrariesParsed = YAML.parse(claroLibraries)

  const sheets = cssGroups.map((group) => {
    return Object.values<DrupalLibrary>(claroLibrariesParsed)
      .flatMap((lib) => {
        return Object.entries(lib.css?.[group] ?? {})
      })
  }).flatMap((val) => {
    return val.sort((a, b) => {
      const aw = a[1].weight ?? 0
      const bw = b[1].weight ?? 0
      if (aw > bw)
        return 1
      if (aw < bw)
        return -1
      return 0
    })
  }).map((val) => {
    return `<link rel="stylesheet" href="/${claroPath}/${val[0]}">`
  }).join('')

  return `<link rel="stylesheet" href="/vendor/drupal/core/assets/vendor/normalize-css/normalize.css">${sheets}`
}
