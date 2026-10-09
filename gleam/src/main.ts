import { App } from './app/App'

const root = document.getElementById('app')
if (!root) throw new Error('Missing #app')
new App(root)
