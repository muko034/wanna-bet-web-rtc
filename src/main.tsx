import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { isDebugMode } from './debug-mode.ts'

if (isDebugMode()) {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

render(<App />, document.getElementById('app')!)
