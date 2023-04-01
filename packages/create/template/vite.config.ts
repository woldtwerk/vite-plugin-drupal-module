import { defineConfig } from 'vite'
import Drupal from '@woldtwerk/vite-plugin-drupal-module'

export default defineConfig({
  plugins: [
    Drupal(),
  ],
})
