/**
 * Import + Export view.
 *
 * Export formats:
 *   - JSON dump
 *   - Markdown ZIP (one .md per entry)
 *   - Single concatenated Markdown bundle
 *   - PDF (one entry per page) via jsPDF
 *
 * Import formats:
 *   - Day One JSON export (`{ entries: [{ text, creationDate, tags, ... }, ...] }`)
 *   - Generic CSV with headers (title, body, mood, tags, date)
 *   - Plain Markdown file (one entry — title taken from first H1, date from front-matter or today)
 */
import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { listEntries, saveEntry, newEntryId } from '~/lib/journalDb'
import { mdToHtml } from '~/lib/markdown'
import type { Entry, JournalType, Mood } from '~/lib/types'

interface Props { uid: string; mode: 'export' | 'import' }

export default function ImportExportView({ uid, mode }: Props) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const exportJson = async () => {
    setBusy(true); setMsg(null)
    try {
      const rows = await listEntries(uid, { limit: 5000 })
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries: rows }, null, 2)], { type: 'application/json' })
      saveAs(blob, `oriz-journal-export-${Date.now()}.json`)
      setMsg(`Exported ${rows.length} entries as JSON.`)
    } finally { setBusy(false) }
  }

  const exportMdZip = async () => {
    setBusy(true); setMsg(null)
    try {
      const rows = await listEntries(uid, { limit: 5000 })
      const zip = new JSZip()
      for (const e of rows) {
        const slug = (e.title || 'entry').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
        const file = `${e.entryDate}-${slug || 'entry'}.md`
        const md = `---\ntitle: ${e.title || ''}\ndate: ${e.entryDate}\nmood: ${e.mood ?? ''}\ntags: [${(e.tags || []).join(', ')}]\ntype: ${e.journalType}\n---\n\n${e.body || ''}`
        zip.file(file, md)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      saveAs(blob, `oriz-journal-markdown-${Date.now()}.zip`)
      setMsg(`Exported ${rows.length} entries to a Markdown ZIP.`)
    } finally { setBusy(false) }
  }

  const exportMdBundle = async () => {
    setBusy(true); setMsg(null)
    try {
      const rows = await listEntries(uid, { limit: 5000 })
      const md = rows.map((e) => `# ${e.title || 'Untitled'}\n\n*${e.entryDate} · ${e.journalType}${e.mood ? ` · ${e.mood}` : ''}*\n\n${e.body || ''}\n\n---\n`).join('\n')
      const blob = new Blob([md], { type: 'text/markdown' })
      saveAs(blob, `oriz-journal-bundle-${Date.now()}.md`)
      setMsg(`Bundle of ${rows.length} entries downloaded.`)
    } finally { setBusy(false) }
  }

  const exportPdf = async () => {
    setBusy(true); setMsg(null)
    try {
      const rows = await listEntries(uid, { limit: 1000 })
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 48
      let y = margin
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
      doc.text('oriz Journal export', margin, y); y += 28
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
      doc.text(new Date().toLocaleString(), margin, y); y += 24
      for (const e of rows) {
        if (y > pageH - margin) { doc.addPage(); y = margin }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
        const title = e.title || 'Untitled entry'
        doc.text(title, margin, y); y += 18
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
        doc.text(`${e.entryDate} · ${e.journalType}${e.mood ? ` · ${e.mood}` : ''}`, margin, y); y += 14
        const lines = doc.splitTextToSize(e.body || '', doc.internal.pageSize.getWidth() - margin * 2)
        doc.setFontSize(11)
        for (const line of lines) {
          if (y > pageH - margin) { doc.addPage(); y = margin }
          doc.text(line, margin, y); y += 14
        }
        y += 10
      }
      doc.save(`oriz-journal-${Date.now()}.pdf`)
      setMsg(`PDF export of ${rows.length} entries generated.`)
    } finally { setBusy(false) }
  }

  const importFile = async (file: File) => {
    setBusy(true); setMsg(null)
    try {
      const text = await file.text()
      let imported = 0
      if (file.name.endsWith('.json')) {
        const j = JSON.parse(text) as Record<string, unknown>
        // Day One: { entries: [{ text, creationDate, tags, ... }] }
        const list = (Array.isArray(j) ? j : (j.entries as unknown[]) ?? []) as Record<string, unknown>[]
        for (const raw of list) {
          const date = (raw.creationDate as string)?.slice(0, 10) || (raw.entryDate as string) || new Date().toISOString().slice(0, 10)
          const body = (raw.text as string) || (raw.body as string) || ''
          const e: Entry = {
            id: newEntryId(),
            title: (raw.title as string) || (body.split('\n')[0]?.replace(/^#\s+/, '').slice(0, 80) || 'Imported entry'),
            body,
            bodyHtml: mdToHtml(body),
            mood: (raw.mood as Mood) ?? null,
            moodIntensity: null,
            tags: ((raw.tags as string[]) ?? []).map((t) => t.toLowerCase().replace(/[^a-z0-9-]+/g, '-')),
            journalType: ((raw.journalType as JournalType) ?? 'daily'),
            entryDate: date,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            favorite: false,
            pinned: false,
            isDraft: false,
            wordCount: body.trim().split(/\s+/).filter(Boolean).length,
            photoUrls: [],
            weather: null,
          }
          await saveEntry(uid, e); imported += 1
        }
      } else if (file.name.endsWith('.csv')) {
        const [header, ...rows] = text.split(/\r?\n/).filter(Boolean)
        const cols = header.split(',').map((c) => c.trim().toLowerCase())
        for (const row of rows) {
          const fields = row.split(',') // naive — assumes no commas in body
          const rec: Record<string, string> = {}
          cols.forEach((c, i) => (rec[c] = fields[i] ?? ''))
          const body = rec.body || ''
          const e: Entry = {
            id: newEntryId(),
            title: rec.title || 'Imported',
            body,
            bodyHtml: mdToHtml(body),
            mood: (rec.mood as Mood) || null,
            moodIntensity: null,
            tags: (rec.tags || '').split(/[;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean),
            journalType: (rec.type as JournalType) || 'daily',
            entryDate: rec.date || new Date().toISOString().slice(0, 10),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            favorite: false,
            pinned: false,
            isDraft: false,
            wordCount: body.trim().split(/\s+/).filter(Boolean).length,
            photoUrls: [],
            weather: null,
          }
          await saveEntry(uid, e); imported += 1
        }
      } else {
        // single markdown file
        const title = (text.split('\n').find((l) => l.startsWith('# '))?.slice(2) || file.name.replace(/\.md$/, '')).trim()
        const e: Entry = {
          id: newEntryId(),
          title,
          body: text,
          bodyHtml: mdToHtml(text),
          mood: null,
          moodIntensity: null,
          tags: [],
          journalType: 'daily',
          entryDate: new Date().toISOString().slice(0, 10),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          favorite: false,
          pinned: false,
          isDraft: false,
          wordCount: text.trim().split(/\s+/).filter(Boolean).length,
          photoUrls: [],
          weather: null,
        }
        await saveEntry(uid, e); imported = 1
      }
      setMsg(`Imported ${imported} entries.`)
    } catch (err) {
      console.error(err)
      setMsg('Import failed: ' + (err as Error).message)
    } finally { setBusy(false) }
  }

  if (mode === 'export') {
    return (
      <div className="ie">
        <p className="ie-lede">Take your data with you. Re-import any of these into another oriz journal.</p>
        <div className="ie-grid">
          <button type="button" disabled={busy} onClick={exportJson} className="ie-card"><strong>JSON dump</strong><small>Lossless, includes every field.</small></button>
          <button type="button" disabled={busy} onClick={exportMdZip} className="ie-card"><strong>Markdown ZIP</strong><small>One .md per entry with front-matter.</small></button>
          <button type="button" disabled={busy} onClick={exportMdBundle} className="ie-card"><strong>Single Markdown bundle</strong><small>All entries concatenated.</small></button>
          <button type="button" disabled={busy} onClick={exportPdf} className="ie-card"><strong>PDF</strong><small>Print-friendly export of every entry.</small></button>
        </div>
        {msg && <p className="ie-msg">{msg}</p>}
        <Style />
      </div>
    )
  }

  return (
    <div className="ie">
      <p className="ie-lede">
        Drop in a Day One <code>.json</code>, a generic <code>.csv</code> (columns: title, body, mood, tags, date, type),
        or a single <code>.md</code> file. Each row becomes a new entry on your account.
      </p>
      <label className="ie-drop">
        <input type="file" accept=".json,.csv,.md,.markdown,.txt" disabled={busy} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        <span>{busy ? 'Importing…' : 'Choose a file to import'}</span>
      </label>
      {msg && <p className="ie-msg">{msg}</p>}
      <Style />
    </div>
  )
}

function Style() {
  return <style>{`
    .ie { display: flex; flex-direction: column; gap: 1rem; }
    .ie-lede { color: var(--color-fg-muted); margin: 0; }
    .ie-grid { display: grid; gap: 0.625rem; grid-template-columns: 1fr; }
    @media (min-width: 640px) { .ie-grid { grid-template-columns: repeat(2, 1fr); } }
    .ie-card { text-align: left; padding: 1rem 1.125rem; background: var(--color-bg-soft); border: 1px solid var(--color-border); border-radius: var(--radius-card); color: var(--color-fg); cursor: pointer; display: flex; flex-direction: column; gap: 0.25rem; }
    .ie-card:hover:not(:disabled) { border-color: var(--color-accent); }
    .ie-card strong { font-family: var(--font-serif); font-weight: 600; }
    .ie-card small { color: var(--color-fg-muted); font-size: 0.8125rem; }
    .ie-drop { display: grid; place-items: center; padding: 2rem; background: var(--color-bg-soft); border: 1px dashed var(--color-border); border-radius: var(--radius-card); cursor: pointer; }
    .ie-drop input { display: none; }
    .ie-drop span { color: var(--color-fg-muted); font-size: 0.9375rem; }
    .ie-msg { padding: 0.625rem 0.875rem; background: color-mix(in oklab, var(--color-accent) 12%, transparent); border-radius: var(--radius-button); font-size: 0.875rem; margin: 0; }
  `}</style>
}
