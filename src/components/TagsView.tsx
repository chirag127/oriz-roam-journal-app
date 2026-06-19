/**
 * Tags index — all tags with counts. Built from the materialised /tags/{slug} docs.
 */
import { useEffect, useState } from 'react'
import { listTags } from '~/lib/journalDb'
import type { Tag } from '~/lib/types'

interface Props { uid: string }

export default function TagsView({ uid }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTags(uid).then((rows) => {
      setTags(rows.sort((a, b) => b.count - a.count))
      setLoading(false)
    })
  }, [uid])

  if (loading) return <p style={{ padding: '2rem', color: 'var(--color-fg-muted)' }}>Loading…</p>
  if (tags.length === 0) return (
    <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
      No tags yet. Tags accumulate as you write entries.
    </p>
  )

  return (
    <div className="tg">
      {tags.map((t) => (
        <a key={t.id} href={`/tags/${encodeURIComponent(t.id)}`} className="tg-chip">
          <span>#{t.id}</span>
          <small>{t.count}</small>
        </a>
      ))}
      <style>{`
        .tg { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .tg-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: 9999px; color: var(--color-fg); text-decoration: none; font-size: 0.875rem; transition: border-color 120ms; }
        .tg-chip:hover { border-color: var(--color-accent); }
        .tg-chip small { font-size: 0.75rem; padding: 0 0.375rem; background: var(--color-bg-muted); border-radius: 9999px; color: var(--color-fg-muted); }
      `}</style>
    </div>
  )
}
