/**
 * Markdown <-> HTML helpers, single-place. We use marked (small, fast) for
 * MD → HTML render, and turndown for HTML → MD when exporting from TipTap
 * (TipTap stores HTML; we keep MD as the canonical body and re-render HTML
 * for read view).
 */
import { marked } from 'marked'
import TurndownService from 'turndown'

let _td: TurndownService | null = null
function td() {
  if (!_td) _td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
  return _td
}

export function mdToHtml(md: string): string {
  return marked.parse(md, { breaks: true, gfm: true }) as string
}

export function htmlToMd(html: string): string {
  return td().turndown(html)
}
