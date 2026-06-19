/**
 * InstallPrompt — captures the `beforeinstallprompt` event and presents a
 * native install button. Hides itself once the app is installed.
 */
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (window.matchMedia?.('(display-mode: standalone)').matches) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !evt) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await evt.prompt()
        const { outcome } = await evt.userChoice
        if (outcome === 'accepted') setEvt(null)
      }}
      className="install-btn"
    >
      ⬇ Install Journal
      <style>{`
        .install-btn { display: inline-flex; align-items: center; gap: 0.375rem; height: 38px; padding-inline: 0.875rem; background: var(--color-accent); color: var(--color-accent-fg); border: 1px solid var(--color-accent); border-radius: var(--radius-button); cursor: pointer; font: inherit; font-weight: 500; }
      `}</style>
    </button>
  )
}
