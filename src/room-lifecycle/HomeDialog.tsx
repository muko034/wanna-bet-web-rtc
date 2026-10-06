import type { HomeDialog as HomeDialogView, HomeDialogAction, HomeDialogOption } from './home-dialog';

type Props = {
  dialog: HomeDialogView;
  onChoose: (action: HomeDialogAction) => void;
};

const STYLE_CLASS: Record<HomeDialogOption['style'], string> = {
  destructive: 'vb-dialog-destructive',
  primary: 'vb-cta',
  link: 'vb-dialog-link',
};

/** Confirmation dialog the Home button opens during a Game; its options come from `resolveHomeDialog`. */
export function HomeDialog({ dialog, onChoose }: Props) {
  return (
    <div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={() => onChoose('cancel')}>
      <div class="vb-dialog" role="dialog" aria-label="Leave the Game?" onClick={(event) => event.stopPropagation()}>
        {dialog.options.map((option) => (
          <button key={option.action} class={STYLE_CLASS[option.style]} type="button" onClick={() => onChoose(option.action)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
