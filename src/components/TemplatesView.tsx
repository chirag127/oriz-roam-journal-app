/**
 * TemplatesView — gallery of built-in + user templates with a "Use" CTA.
 */
import { useEffect, useState } from 'react'
import { listTemplates, saveTemplate, deleteTemplate, newTemplateId } from '~/lib/journalDb'
import type { Template } from '~/lib/types'
import { JOURNAL_TYPES } from '~/lib/types'

interface Props { uid: string }

export default function TemplatesView({ uid }: Props) {
  const [tpls, setTpls] = useState<Template[]>([])
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Partial<Template>>({})
  const reload = async () => setTpls(await listTemplates(uid))
  useEffect(() => { reload() }, [uid]) // eslint-disable-line

  const create = async () => {
    if (!draft.name || !draft.structure) return
    const t: Template = {
      id: newTemplateId(),
      name: draft.name!,
      description: draft.description || '',
      structure: draft.structure!,
      defaultJournalType: (draft.defaultJournalType as Template['defaultJournalType']) || 'custom',
      defaultMoodRequired: !!draft.defaultMoodRequired,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveTemplate(uid, t)
    setCreating(false); setDraft({}); reload()
  }

  return (
    <div className="tv">
      <div className="tv-bar">
        <p className="tv-lede">Pick a template or define your own. The slug is reused as the URL parameter on <code>/entries/new</code>.</p>
        <button type="button" className="tv-cta" onClick={() => setCreating(true)}>+ Custom template</button>
      </div>

      {creating && (
        <div className="tv-card tv-form">
          <input placeholder="Template name" value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <textarea placeholder="Description (optional)" value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <textarea placeholder="Markdown skeleton (use # H1, ## H2, - lists, etc.)" rows={8} value={draft.structure || ''} onChange={(e) => setDraft({ ...draft, structure: e.target.value })} />
          <div className="tv-form-row">
            <select value={draft.defaultJournalType || 'custom'} onChange={(e) => setDraft({ ...draft, defaultJournalType: e.target.value as Template['defaultJournalType'] })}>
              {JOURNAL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
            <label className="tv-toggle"><input type="checkbox" checked={!!draft.defaultMoodRequired} onChange={(e) => setDraft({ ...draft, defaultMoodRequired: e.target.checked })} /> Mood required</label>
          </div>
          <div className="tv-form-actions">
            <button type="button" onClick={create} className="tv-save">Save template</button>
            <button type="button" onClick={() => { setCreating(false); setDraft({}) }} className="tv-cancel">Cancel</button>
          </div>
        </div>
      )}

      <div className="tv-grid">
        {tpls.map((t) => (
          <div key={t.id} className="tv-card">
            <div className="tv-head">
              <strong>{t.name}</strong>
              {t.isBuiltIn && <span className="tv-badge">built-in</span>}
            </div>
            <p className="tv-desc">{t.description}</p>
            <pre className="tv-preview">{t.structure.slice(0, 220)}{t.structure.length > 220 ? '…' : ''}</pre>
            <div className="tv-actions">
              <a className="tv-use" href={`/entries/new?template=${encodeURIComponent(t.id)}`}>Use →</a>
              {!t.isBuiltIn && (
                <button type="button" className="tv-del" onClick={async () => { await deleteTemplate(uid, t.id); reload() }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .tv { display: flex; flex-direction: column; gap: 1rem; }
        .tv-bar { display: flex; align-items: center; gap: 1rem; }
        .tv-lede { color: var(--color-fg-muted); margin: 0; flex: 1; }
        .tv-cta { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: var(--color-accent); color: var(--color-accent-fg); border: 1px solid var(--color-accent); font-weight: 500; cursor: pointer; }
        .tv-grid { display: grid; gap: 0.75rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .tv-grid { grid-template-columns: repeat(2, 1fr); } }
        .tv-card { padding: 1rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 0.5rem; }
        .tv-head { display: flex; align-items: center; gap: 0.5rem; }
        .tv-badge { font-size: 0.6875rem; padding: 0.0625rem 0.375rem; background: var(--color-bg-muted); border-radius: 9999px; color: var(--color-fg-muted); }
        .tv-desc { margin: 0; color: var(--color-fg-muted); font-size: 0.875rem; }
        .tv-preview { background: var(--color-bg); padding: 0.625rem; border-radius: var(--radius-button); font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-fg-muted); margin: 0; max-height: 120px; overflow: hidden; white-space: pre-wrap; }
        .tv-actions { display: flex; gap: 0.5rem; }
        .tv-use { padding: 0.375rem 0.75rem; background: var(--color-accent); color: var(--color-accent-fg); border-radius: var(--radius-button); text-decoration: none; font-size: 0.8125rem; font-weight: 500; }
        .tv-del { padding: 0.375rem 0.75rem; background: transparent; color: var(--color-fg-muted); border: 1px solid var(--color-border); border-radius: var(--radius-button); cursor: pointer; font-size: 0.75rem; }
        .tv-form input, .tv-form select, .tv-form textarea { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-button); color: var(--color-fg); padding: 0.5rem 0.625rem; font: inherit; font-size: 0.875rem; }
        .tv-form textarea { resize: vertical; }
        .tv-form-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .tv-toggle { display: inline-flex; gap: 0.375rem; align-items: center; font-size: 0.875rem; color: var(--color-fg-muted); }
        .tv-form-actions { display: flex; gap: 0.5rem; }
        .tv-save { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: var(--color-accent); color: var(--color-accent-fg); border: 1px solid var(--color-accent); cursor: pointer; }
        .tv-cancel { padding: 0.5rem 0.875rem; border-radius: var(--radius-button); background: transparent; color: var(--color-fg); border: 1px solid var(--color-border); cursor: pointer; }
      `}</style>
    </div>
  )
}
