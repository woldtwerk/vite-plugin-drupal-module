import typescriptLogo from '/typescript.svg'
import viteLogo from '/vite.svg'
import drupalLogo from '/drupal.svg'

Drupal.behaviors.vite = {
  attach(context) {
    const [app] = once('vite', '#app', context)
    app.innerHTML = `
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="${viteLogo}" class="logo" alt="Vite logo" />
        </a>
        <a href="https://www.typescriptlang.org/" target="_blank">
          <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
        </a>
        <a href="https://www.drupal.org/" target="_blank">
          <img src="${drupalLogo}" class="logo vanilla" alt="Drupal logo" />
        </a>
        <h1>Vite + TypeScript + Drupal</h1>
        <div class="container">
          <button id="counter" type="button" class="button"></button>
        </div>
        <p class="read-the-docs">
          ${Drupal.t('Click on the Vite, TypeScript and Drupal logos to learn more')}
        </p>
      </div>
    `
  },
}

Drupal.behaviors.counter = {
  attach(context) {
    const [button] = once<HTMLButtonElement>('counter', '#counter', context)
    setupCounter(button)
  },
}
