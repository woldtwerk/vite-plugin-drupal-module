import path from 'node:path'
import fs from 'node:fs/promises'
import { execa } from 'execa'
import { cancel, intro, isCancel, multiselect, outro, spinner, text } from '@clack/prompts'
import color from 'picocolors'
import { installPackage } from '@antfu/install-pkg'
import fg from 'fast-glob'
import fse from 'fs-extra'

(async () => {
  intro(color.inverse(' Create Drupal Module '))

  const files = await fs.readdir(process.cwd())
  const infoYml = files.filter(file => file.match(/\.info\.yml$/))?.at(0)
  const s = spinner()

  const name = infoYml
    ? infoYml.replace(/\.info\.yml$/, '')
    : await text({
      message: 'Module name:',
      placeholder: 'Anonymous',
    })

  !infoYml && await fs.writeFile(`${name.toString()}.info.yml`, `name: ${name.toString()}\ntype: module`)

  if (isCancel(name)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  const features = await multiselect({
    message: 'Pick optional features.',
    options: [
      { value: 'vue', label: 'Vue' },
    ],
    required: false,
  })

  if (isCancel(features)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  const pkgJson = files.filter(file => file.match('package.json'))?.at(0)
  !pkgJson && await fs.writeFile('package.json', JSON.stringify({
    name,
    version: '0.0.1',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      release: `pnpm dlx bumpp ${name}.libraries.yml package.json composer.json --tag "%s" --no-push`,
      prerelease: 'pnpm build',
    },
  }, null, 2))

  s.start('Installing packages...')
  const packages = [
    'vite',
    'typescript',
    '@woldtwerk/vite-plugin-drupal-module',
    ...(features.includes('vue')
      ? ['vue', '@vitejs/plugin-vue', 'unplugin-vue-components']
      : []
    ),
  ]
  await installPackage(packages, { dev: true, silent: true })
  s.stop('Finished installing packages.')

  s.start('Installing Drupal Core...')
  const composerJson = files.filter(file => file.match('composer.json'))?.at(0)
  !composerJson && await fs.writeFile('composer.json', JSON.stringify({
    name,
    version: '0.0.1',
  }, null, 4))
  await execa('composer', ['require', 'drupal/core', '--dev'])
  s.stop('Finished installing Drupal Core.')

  s.start('Copying files...')
  await copyFiles(name)
  s.stop('Finished copying files.')

  outro(`All done 🎉\nStart by running ${color.inverse(' pnpm dev ')}`)
})()

async function copyFiles(name: string) {
  const files = await fg([
    '**/*',
  ], {
    onlyFiles: true,
    dot: true,
    cwd: path.resolve(__dirname, '../template'),
  })

  files.forEach(async (file) => {
    const content = await fse.readFile(path.resolve(__dirname, '../template', file), 'utf8')
    await fse.outputFile(path.resolve(process.cwd(), file.replace('module_name', name)), content.replace(/module_name/g, name))
  })
}
