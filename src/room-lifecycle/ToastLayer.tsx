import { useT } from '../i18n/LanguageContext';
import type { Toast } from './use-toasts';

/** The notices floating in front of the screen; they take no taps, so the controls beneath stay usable. */
export function ToastLayer({ toasts }: { toasts: Toast[] }) {
  const t = useT();
  return (
    <div class="vb-toasts">
      {toasts.map((toast) => (
        <div class="vb-toast" role="status" key={toast.id}>
          {t(toast.message.key, toast.message.params)}
          {toast.hint && <span class="vb-toast-hint">{t(toast.hint.key, toast.hint.params)}</span>}
        </div>
      ))}
    </div>
  );
}
