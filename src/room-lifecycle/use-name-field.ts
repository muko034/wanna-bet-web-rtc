import { useState } from 'preact/hooks';
import { normalizeName, truncateName } from '../protocol/player-name';

/**
 * State of a form's name input. The shown text is held at the name limit (typed or pasted),
 * while `name` is the trimmed text to send and `valid` says whether the form may be submitted.
 */
export function useNameField() {
  const [text, setText] = useState('');

  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const truncated = truncateName(input.value);
    // Written back because a truncation that leaves the state unchanged would not re-render the input.
    if (input.value !== truncated) input.value = truncated;
    setText(truncated);
  };

  return { text, onInput, ...normalizeName(text) };
}
