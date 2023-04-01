import type Unimport from 'unimport/unplugin'
import type { Options as ComponentOptions } from 'unplugin-vue-components'
import type { Options as VueOptions } from '@vitejs/plugin-vue'

export interface Options {
  version: 'drupal' | 'hash' | 'module'
  unimport: Partial<Parameters<typeof Unimport.vite>>[0]
  components: ComponentOptions
  vue: VueOptions
}

export type UserOptions = Partial<Options>
