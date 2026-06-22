/**
 * MapView — Pro-gated wrapper for /map. Mirrors HabitsIndexView's paywall
 * pattern: the data layer still works for free-tier users during preview;
 * the card is a soft upsell that hard-blocks once billing ships.
 */
import AuthGate from './AuthGate'
import EntryMap from './EntryMap'
import { useTierGate } from '~/lib/useTierGate'

export default function MapView() {
  return (
    <AuthGate>
      {(uid) => <MapInner uid={uid} />}
    </AuthGate>
  )
}

function MapInner({ uid }: { uid: string }) {
  const { tier } = useTierGate()
  return (
    <div className="mv">
      {tier === 'free' && <PaywallCard />}
      <EntryMap uid={uid} />
      <style>{`
        .mv { display: flex; flex-direction: column; gap: 1.5rem; font-family: var(--font-body); }
      `}</style>
    </div>
  )
}

function PaywallCard() {
  return (
    <aside className="pw">
      <div className="pw-row">
        <span className="pw-tag">pro</span>
        <h2 className="pw-h">Travel mode is a Pro feature</h2>
      </div>
      <p className="pw-body">
        You're on the free tier — you can still drop pins and view the map during preview, but the
        feature will move to <strong>oriz Pro</strong> when billing ships. Your data stays put.
      </p>
      <p className="pw-cta">
        <a href="/account/" className="pw-link">
          manage account &rarr;
        </a>
      </p>
      <style>{`
        .pw {
          border-left: 2px solid var(--seal-red);
          padding: 0.875rem 1rem;
          background: color-mix(in oklab, var(--seal-red) 6%, transparent);
          font-family: var(--font-body);
          color: var(--page-cream);
        }
        @media (prefers-color-scheme: light) { .pw { color: var(--ink, #1a1a22); } }
        .pw-row { display: flex; align-items: baseline; gap: 0.625rem; margin-bottom: 0.5rem; }
        .pw-tag {
          font-family: var(--font-sans);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--seal-red);
          border: 1px solid var(--seal-red);
          padding: 1px 6px;
        }
        .pw-h { margin: 0; font-family: var(--font-display); font-size: 1.0625rem; font-weight: 600; }
        .pw-body { margin: 0 0 0.5rem; color: var(--graphite); line-height: 1.55; max-width: 56ch; }
        .pw-cta { margin: 0; font-size: 0.875rem; }
        .pw-link { color: var(--seal-red); text-decoration: none; border-bottom: 1px solid var(--seal-red); padding-bottom: 1px; }
      `}</style>
    </aside>
  )
}
