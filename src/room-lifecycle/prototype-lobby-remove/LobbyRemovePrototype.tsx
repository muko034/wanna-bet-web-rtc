/**
 * PROTOTYPE — throwaway. Delete me.
 *
 * Question: how should the Host open the Remove confirm dialog in the Lobby without a ✕ on each row?
 * Five variants, switchable via `?variant=A..E` on the dev-only route `/prototype/lobby`
 * (run `npm run dev`, open http://localhost:5173/wanna-bet-web-rtc/prototype/lobby?variant=B).
 *
 * Why a separate route instead of the real `/room/<CODE>`: the real Lobby needs live PeerJS Guests.
 * This route reuses the real PhoneShell, CSS classes and RemoveGuestDialog with fake Guests and a stubbed Remove.
 */
import { useEffect, useState } from 'preact/hooks';
import { PhoneShell } from '../../PhoneShell';
import { useT } from '../../i18n/LanguageContext';
import { RemoveGuestDialog } from '../RemoveGuestDialog';

type Guest = { playerId: string; name: string };
type Target = { playerId: string; name: string };
type Ask = (target: Target) => void;

const SEED: Guest[] = [
  { playerId: 'g1', name: 'Ann' },
  { playerId: 'g2', name: 'Bob' },
  { playerId: 'g3', name: 'Cy' },
  { playerId: 'g4', name: 'Dee' },
];

const VARIANTS = [
  { key: 'A', label: 'Current ✕ (baseline)' },
  { key: 'B', label: 'Tap row + hint line' },
  { key: 'C', label: 'Manage mode (− badges)' },
  { key: 'D', label: 'Swipe row to reveal' },
  { key: 'E', label: 'Tap row → action sheet' },
] as const;

type VariantKey = (typeof VARIANTS)[number]['key'];

function readVariant(): VariantKey {
  const raw = new URLSearchParams(location.search).get('variant');
  return VARIANTS.some((v) => v.key === raw) ? (raw as VariantKey) : 'A';
}

export function LobbyRemovePrototype(_props: { path?: string }) {
  const t = useT();
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const [guests, setGuests] = useState<Guest[]>(SEED);
  const [removing, setRemoving] = useState<Target | null>(null);
  const [lastAction, setLastAction] = useState('none');

  const go = (next: VariantKey) => {
    const url = new URL(location.href);
    url.searchParams.set('variant', next);
    history.replaceState(null, '', url);
    setVariant(next);
    setRemoving(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const i = VARIANTS.findIndex((v) => v.key === variant);
      if (event.key === 'ArrowLeft') go(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length].key);
      if (event.key === 'ArrowRight') go(VARIANTS[(i + 1) % VARIANTS.length].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ask: Ask = (target) => {
    setLastAction(`open dialog for ${target.name}`);
    setRemoving(target);
  };
  const props = { guests, ask, t };

  return (
    <>
      <style>{CSS}</style>
      <PhoneShell
        background="vb-bg-lobby"
        roomCode="ABCD"
        overlay={
          removing && (
            <RemoveGuestDialog
              name={removing.name}
              onConfirm={() => {
                setGuests((list) => list.filter((g) => g.playerId !== removing.playerId));
                setLastAction(`removed ${removing.name}`);
                setRemoving(null);
              }}
              onCancel={() => {
                setLastAction(`cancelled ${removing.name}`);
                setRemoving(null);
              }}
            />
          )
        }
      >
        <div class="vb-eyebrow2">{t('lobby.roomCode')}</div>
        <div class="vb-code-giant">
          <span>ABCD</span>
        </div>
        {variant === 'A' && <VariantA {...props} />}
        {variant === 'B' && <VariantB {...props} />}
        {variant === 'C' && <VariantC {...props} />}
        {variant === 'D' && <VariantD {...props} />}
        {variant === 'E' && <VariantE {...props} />}
        <div class="vb-status-pill">{t('lobby.notStarted')}</div>
        <button class="vb-cta" type="button" disabled={guests.length === 0}>
          {t('lobby.start')}
        </button>
      </PhoneShell>

      <div class="pt-bar">
        <button type="button" onClick={() => go(VARIANTS[(VARIANTS.findIndex((v) => v.key === variant) + VARIANTS.length - 1) % VARIANTS.length].key)}>
          ←
        </button>
        <div class="pt-label">
          {variant} · {VARIANTS.find((v) => v.key === variant)?.label}
          <small>
            guests: {guests.map((g) => g.name).join(', ') || '—'} · last: {lastAction}
          </small>
        </div>
        <button type="button" onClick={() => go(VARIANTS[(VARIANTS.findIndex((v) => v.key === variant) + 1) % VARIANTS.length].key)}>
          →
        </button>
        <button type="button" onClick={() => { setGuests(SEED); setLastAction('reset'); }}>
          reset
        </button>
      </div>
    </>
  );
}

type VariantProps = { guests: Guest[]; ask: Ask; t: ReturnType<typeof useT> };

function HostChip({ t }: { t: VariantProps['t'] }) {
  return <div class="vb-avatar">{t('player.you', { name: 'Host' })}</div>;
}

/** A: today's shipped behaviour, for comparison. */
function VariantA({ guests, ask, t }: VariantProps) {
  return (
    <div class="vb-avatar-row">
      <HostChip t={t} />
      {guests.map((g) => (
        <div class="vb-avatar" key={g.playerId}>
          <span>{g.name}</span>
          <button class="vb-avatar-remove" type="button" aria-label={t('lobby.removeGuest', { name: g.name })} onClick={() => ask(g)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/** B: the whole chip is the button. A hint line carries discoverability. */
function VariantB({ guests, ask, t }: VariantProps) {
  return (
    <>
      <div class="vb-avatar-row">
        <HostChip t={t} />
        {guests.map((g) => (
          <button class="vb-avatar pt-tap" type="button" key={g.playerId} aria-label={t('lobby.removeGuest', { name: g.name })} onClick={() => ask(g)}>
            {g.name}
          </button>
        ))}
      </div>
      {guests.length > 0 && <div class="pt-hint">Tap a player to remove them</div>}
    </>
  );
}

/** C: an explicit Manage / Done mode. Normal state is calm; Manage reveals − badges on Guests. */
function VariantC({ guests, ask, t }: VariantProps) {
  const [managing, setManaging] = useState(false);
  return (
    <>
      <div class="vb-avatar-row">
        <HostChip t={t} />
        {guests.map((g) =>
          managing ? (
            <button class="vb-avatar pt-tap pt-manage" type="button" key={g.playerId} aria-label={t('lobby.removeGuest', { name: g.name })} onClick={() => ask(g)}>
              <span class="pt-badge" aria-hidden="true">−</span>
              {g.name}
            </button>
          ) : (
            <div class="vb-avatar" key={g.playerId}>{g.name}</div>
          ),
        )}
      </div>
      {guests.length > 0 && (
        <button class="pt-pill" type="button" onClick={() => setManaging(!managing)}>
          {managing ? 'Done' : 'Manage players'}
        </button>
      )}
    </>
  );
}

/** D: vertical list. Swipe a row left (scroll-snap) to reveal a red Remove panel. No hint needed on iOS-trained thumbs. */
function VariantD({ guests, ask, t }: VariantProps) {
  return (
    <div class="pt-list">
      <div class="vb-avatar pt-row-plain">{t('player.you', { name: 'Host' })}</div>
      {guests.map((g) => (
        <div class="pt-swipe" key={g.playerId}>
          <div class="vb-avatar pt-swipe-main">{g.name}</div>
          <button class="pt-swipe-action" type="button" aria-label={t('lobby.removeGuest', { name: g.name })} onClick={() => ask(g)}>
            {t('hostMenu.remove')}
          </button>
        </div>
      ))}
      {guests.length > 0 && <div class="pt-hint" style={{ margin: '4px 0 0' }}>← swipe a player to remove</div>}
    </div>
  );
}

/** E: tap a chip for a per-player action sheet (same shape as the in-game menu), whose Remove opens the confirm dialog. */
function VariantE({ guests, ask, t }: VariantProps) {
  const [open, setOpen] = useState<Guest | null>(null);
  return (
    <>
      <div class="vb-avatar-row">
        <HostChip t={t} />
        {guests.map((g) => (
          <button class="vb-avatar pt-tap" type="button" key={g.playerId} aria-label={t('hostMenu.open', { name: g.name })} onClick={() => setOpen(g)}>
            {g.name} <span aria-hidden="true">⋯</span>
          </button>
        ))}
      </div>
      {open && (
        <div class="vb-rank-sheet-backdrop vb-dialog-backdrop" onClick={() => setOpen(null)}>
          <div class="vb-dialog" role="menu" onClick={(event) => event.stopPropagation()}>
            <div class="vb-dialog-title">{open.name}</div>
            <button
              class="vb-dialog-destructive"
              type="button"
              onClick={() => {
                const target = open;
                setOpen(null);
                ask(target);
              }}
            >
              {t('hostMenu.remove')}
            </button>
            <button class="vb-dialog-link" type="button" onClick={() => setOpen(null)}>
              {t('homeDialog.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
.pt-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;align-items:center;
  padding:8px 12px;border-radius:999px;background:#111;color:#fff;font:600 13px system-ui;box-shadow:0 4px 18px rgba(0,0,0,.4);max-width:96vw}
.pt-bar button{border:0;border-radius:999px;background:#333;color:#fff;padding:6px 12px;font:inherit;cursor:pointer}
.pt-label{display:flex;flex-direction:column;min-width:0}
.pt-label small{font-weight:400;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-tap{border:0;color:inherit;font:inherit;font-weight:700;font-size:12px;cursor:pointer;min-height:44px}
.pt-tap:active{background:rgba(255,255,255,.28)}
.pt-hint{margin:-14px 0 20px;font-size:12px;opacity:.7;text-align:center}
.pt-pill{display:block;margin:-10px auto 20px;border:0;border-radius:999px;padding:8px 16px;background:rgba(255,255,255,.18);color:inherit;font:700 12px inherit;cursor:pointer}
.pt-manage{position:relative;animation:pt-wiggle .35s ease-in-out infinite alternate}
.pt-badge{position:absolute;top:-8px;left:-8px;width:22px;height:22px;border-radius:50%;background:#e5484d;color:#fff;display:grid;place-items:center;font-size:16px;line-height:1}
@keyframes pt-wiggle{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}
.pt-list{display:flex;flex-direction:column;gap:8px;margin-bottom:26px;width:100%}
.pt-row-plain{width:100%;box-sizing:border-box}
.pt-swipe{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:16px}
.pt-swipe::-webkit-scrollbar{display:none}
.pt-swipe-main{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box}
.pt-swipe-action{flex:0 0 96px;scroll-snap-align:end;border:0;background:#e5484d;color:#fff;font:800 13px inherit;cursor:pointer}
`;
