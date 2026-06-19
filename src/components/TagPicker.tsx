/**
 * Tag picker — chip-style multi-select with free-text add.
 */
import { useState } from 'react'

interface Props {
  tags: string[]
  suggestions?: string[]
  onChange: (tags: string[]) => void
}

export default function TagPicker({ tags, suggestions = [], onChange }: Props) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    if (!t || tags.includes(t)) return
    onChange([...tags, t])
    setDraft('')
  }
  const remove = (t: string) => onChange(tags.filter((x) => x !== t))

  return (
    <div className="tag-picker">
      <div className="tag-row">
        {tags.map((t) => (
          <span key={t} className="tag-chip">
            #{t}
            <button type="button" onClick={() => remove(t)} aria-label={`Remove tag ${t}`}>×</button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              remove(tags[tags.length - 1])
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={tags.length ? '' : 'Add tags…'}
          className="tag-input"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="tag-suggest">+ {s}</button>
          ))}
        </div>
      )}
      <style>{`
        .tag-picker { display: flex; flex-direction: column; gap: 0.5rem; }
        .tag-row {
          display: flex; flex-wrap: wrap; gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          background: var(--color-bg-soft);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-button);
          min-height: 40px;
        }
        .tag-chip {
          display: inline-flex; align-items: center; gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          background: var(--color-bg-muted);
          border: 1px solid var(--color-border);
          border-radius: 9999px;
          font-size: 0.8125rem;
        }
        .tag-chip button { background: none; border: 0; color: var(--color-fg-muted); cursor: pointer; padding: 0; line-height: 1; }
        .tag-input { flex: 1; min-width: 120px; background: none; border: 0; outline: 0; color: var(--color-fg); font: inherit; font-size: 0.875rem; }
        .tag-suggestions { display: flex; gap: 0.375rem; flex-wrap: wrap; }
        .tag-suggest {
          background: none;
          border: 1px dashed var(--color-border);
          border-radius: 9999px;
          padding: 0.125rem 0.5rem;
          color: var(--color-fg-muted);
          cursor: pointer;
          font-size: 0.75rem;
        }
        .tag-suggest:hover { color: var(--color-fg); border-style: solid; }
      `}</style>
    </div>
  )
}
