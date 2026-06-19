/**
 * Mood picker — 5-emoji row + optional 1-10 intensity slider.
 */
import type { Mood } from '~/lib/types'
import { MOODS } from '~/lib/types'

interface Props {
  mood: Mood | null
  intensity: number | null
  onChange: (mood: Mood | null, intensity: number | null) => void
  required?: boolean
  compact?: boolean
}

export default function MoodPicker({ mood, intensity, onChange, required, compact }: Props) {
  return (
    <div className={`mood-picker ${compact ? 'mood-picker-compact' : ''}`}>
      <div className="mood-row" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mood === m.id}
            className={`mood-chip ${mood === m.id ? 'mood-chip-on' : ''}`}
            onClick={() => onChange(mood === m.id ? null : m.id, intensity)}
            style={mood === m.id ? { borderColor: m.color, background: `${m.color}22` } : undefined}
            title={m.label}
          >
            <span className="mood-emoji" aria-hidden="true">{m.emoji}</span>
            {!compact && <span className="mood-label">{m.label}</span>}
          </button>
        ))}
      </div>
      {mood && !compact && (
        <label className="mood-intensity">
          <span className="mood-intensity-label">Intensity</span>
          <input
            type="range" min={1} max={10}
            value={intensity ?? 5}
            onChange={(e) => onChange(mood, Number(e.target.value))}
          />
          <span className="mood-intensity-val">{intensity ?? 5}</span>
        </label>
      )}
      {required && !mood && <p className="mood-required">A mood is required by this template.</p>}

      <style>{`
        .mood-picker { display: flex; flex-direction: column; gap: 0.75rem; }
        .mood-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .mood-chip {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-bg-soft);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-button);
          color: var(--color-fg);
          cursor: pointer; font-size: 0.875rem;
          transition: border-color 120ms, background 120ms;
        }
        .mood-chip:hover { border-color: color-mix(in oklab, var(--color-accent) 60%, var(--color-border)); }
        .mood-emoji { font-size: 1.125rem; }
        .mood-intensity { display: flex; align-items: center; gap: 0.625rem; font-size: 0.875rem; color: var(--color-fg-muted); }
        .mood-intensity input { flex: 1; max-width: 200px; }
        .mood-intensity-val { font-variant-numeric: tabular-nums; min-width: 1.5em; }
        .mood-required { color: #ef4444; font-size: 0.8125rem; margin: 0; }
        .mood-picker-compact .mood-chip { padding: 0.25rem 0.5rem; }
      `}</style>
    </div>
  )
}
