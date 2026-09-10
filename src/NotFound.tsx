import { PhoneShell } from './PhoneShell';

/** Rendered for any route that doesn't match one of the app's known paths. */
export function NotFound(_props: { default?: boolean }) {
  return (
    <PhoneShell background="vb-bg-home">
      <div class="vb-giant-title" style="font-size:24px">
        Page not found
      </div>
      <a class="vb-cta" href="/">
        Back to Home
      </a>
    </PhoneShell>
  );
}
