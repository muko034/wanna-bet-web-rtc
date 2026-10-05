/** The browser capabilities `copyText` relies on, injectable so the fallback logic is testable. */
export type CopyEnv = {
  clipboard: Pick<Clipboard, 'writeText'> | undefined;
  /** Legacy synchronous copy of `text`; returns whether it succeeded. */
  execCommandCopy: (text: string) => boolean;
};

function execCommandCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

const browserEnv = (): CopyEnv => ({ clipboard: navigator.clipboard, execCommandCopy });

/** Copies `text` to the clipboard, falling back to `document.execCommand('copy')`; resolves to whether it worked. */
export async function copyText(text: string, env: CopyEnv = browserEnv()): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // Rejected (permissions, insecure context): fall through to the legacy path.
    }
  }
  return env.execCommandCopy(text);
}
