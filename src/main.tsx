import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'

if (new URLSearchParams(location.search).has('debug')) {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

render(<App />, document.getElementById('app')!)
