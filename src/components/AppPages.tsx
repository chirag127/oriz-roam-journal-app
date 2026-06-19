/**
 * Page-level React wrappers — each combines AuthGate with the right view
 * component so an Astro page only needs to mount one React island.
 *
 * Astro pages render these as <Wrapper client:only="react" />.
 */
import type { ReactNode } from 'react'
import AuthGate from './AuthGate'
import DashboardView from './DashboardView'
import EntryEditor from './EntryEditor'
import EntryReadView from './EntryReadView'
import EntryList from './EntryList'
import CalendarView from './CalendarView'
import MemoriesView from './MemoriesView'
import SearchView from './SearchView'
import StatsView from './StatsView'
import GoalsView from './GoalsView'
import TemplatesView from './TemplatesView'
import TagsView from './TagsView'
import SettingsView from './SettingsView'
import ImportExportView from './ImportExportView'
import DeleteAccountView from './DeleteAccountView'
import type { JournalType } from '~/lib/types'

// ---- Generic factory ----
type Render = (uid: string, isAnonymous: boolean) => ReactNode

function withGate(render: Render) {
  return function Wrapped() {
    return <AuthGate>{render}</AuthGate>
  }
}

// ---- Per-page wrappers ----
export const DashboardPage = withGate((uid, isAnonymous) => <DashboardView uid={uid} isAnonymous={isAnonymous} />)

export function NewEntryPage() {
  return (
    <AuthGate>
      {(uid) => {
        const url = new URL(window.location.href)
        const templateId = url.searchParams.get('template') ?? undefined
        const dt = url.searchParams.get('type') ?? undefined
        return <EntryEditor uid={uid} templateId={templateId} defaultJournalType={dt as JournalType} />
      }}
    </AuthGate>
  )
}

export function EditEntryPage() {
  return (
    <AuthGate>
      {(uid) => {
        const m = window.location.pathname.match(/^\/entries\/([^/]+)\/edit/)
        const id = m ? decodeURIComponent(m[1]) : ''
        return <EntryEditor uid={uid} entryId={id} />
      }}
    </AuthGate>
  )
}

export function ReadEntryPage() {
  return (
    <AuthGate>
      {(uid) => {
        const m = window.location.pathname.match(/^\/entries\/([^/]+)/)
        const id = m ? decodeURIComponent(m[1]) : ''
        return <EntryReadView uid={uid} entryId={id} />
      }}
    </AuthGate>
  )
}

export const EntriesPage = withGate((uid) => <EntryList uid={uid} showFilters />)
export const FavoritesPage = withGate((uid) => <EntryList uid={uid} filter={{ favorite: true }} emptyHint="You haven't favorited any entries yet." />)
export const PinnedPage = withGate((uid) => <EntryList uid={uid} filter={{ pinned: true }} emptyHint="You haven't pinned any entries yet." />)

export function TagPage() {
  return (
    <AuthGate>
      {(uid) => {
        const m = window.location.pathname.match(/^\/tags\/([^/]+)/)
        const tag = m ? decodeURIComponent(m[1]) : ''
        return <EntryList uid={uid} filter={{ tag }} emptyHint={`No entries tagged #${tag} yet.`} />
      }}
    </AuthGate>
  )
}

export const CalendarPage = withGate((uid) => <CalendarView uid={uid} />)
export const MemoriesPage = withGate((uid) => <MemoriesView uid={uid} />)
export function SearchPage() {
  return (
    <AuthGate>
      {(uid) => {
        const initial = new URL(window.location.href).searchParams.get('q') ?? ''
        return <SearchView uid={uid} initialQuery={initial} />
      }}
    </AuthGate>
  )
}
export const StatsPage = withGate((uid) => <StatsView uid={uid} />)
export const GoalsPage = withGate((uid) => <GoalsView uid={uid} />)
export const TemplatesPage = withGate((uid) => <TemplatesView uid={uid} />)
export const TagsPage = withGate((uid) => <TagsView uid={uid} />)
export const SettingsPage = withGate((uid) => <SettingsView uid={uid} />)
export const ExportPage = withGate((uid) => <ImportExportView uid={uid} mode="export" />)
export const ImportPage = withGate((uid) => <ImportExportView uid={uid} mode="import" />)
export const DeleteAccountPage = withGate((uid) => <DeleteAccountView uid={uid} />)
