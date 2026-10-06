import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'
import { isDebugMode } from './debug-mode.ts'

if (isDebugMode()) {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

render(<LanguageProvider><App /></LanguageProvider>, document.getElementById('app')!)
