/// <reference types="vite/client" />
/// <reference types="@woldtwerk/vite-plugin-drupal-module/types/drupal" />
/// <reference path="unimport.d.ts" />
/// <reference path="components.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

export {}