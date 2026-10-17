export type MenuPlacement = 'down' | 'up';

type Measures = {
  triggerTop: number;
  /** Bottom edge of the control that opens the menu. */
  triggerBottom: number;
  menuHeight: number;
  /** Edges of the area the menu must stay inside. */
  containerTop: number;
  containerBottom: number;
};

/** Opens a menu below its trigger, or above it when that would be clipped at the bottom and the top has room. */
export function resolveMenuPlacement({ triggerTop, triggerBottom, menuHeight, containerTop, containerBottom }: Measures): MenuPlacement {
  const fitsBelow = triggerBottom + menuHeight <= containerBottom;
  const fitsAbove = triggerTop - menuHeight >= containerTop;
  return !fitsBelow && fitsAbove ? 'up' : 'down';
}
