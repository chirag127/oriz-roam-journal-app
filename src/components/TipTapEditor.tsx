/**
 * TipTapEditor — v2.
 *
 * Per the v2 brief: NO TOOLBAR AT REST. Formatting only appears as a
 * floating bubble menu when the user has a selection. Six options:
 *   bold · italic · h2 · blockquote · bullet list · link
 *
 * That's the entire formatting surface. No image upload buttons, no h1/h3,
 * no strike, no inline code, no task list, no code block, no ordered list.
 * Drag-drop image upload still works (silently) — it's invisible chrome.
 *
 * Body type is iA Writer Quattro Variable, 18px / 1.7 desktop, 17px / 1.65
 * mobile, 66ch hard cap.
 *
 * NO AI sidebar. NO summarize. NO sentiment. NO auto-tag. (Per the brief —
 * plaintext never leaves the device.)
 */

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import { countWords } from '~/lib/journalDb'
import { htmlToMd } from '~/lib/markdown'
import { type Photo, uploadPhotoForEditor } from '~/lib/photos'

interface Props {
  uid: string
  entryId: string
  initialHtml: string
  placeholder?: string
  initialPhotos?: Photo[]
  onChange: (out: {
    html: string
    markdown: string
    wordCount: number
    photoUrls: string[]
    photos: Photo[]
  }) => void
}

export default function TipTapEditor({
  uid: _uid,
  entryId: _entryId,
  initialHtml,
  placeholder,
  initialPhotos,
  onChange,
}: Props) {
  // Keep a running tally of Photo records keyed by primary URL so the editor
  // can re-emit the correct 4-host tuple on every onChange — TipTap only
  // tracks the img src in the HTML, so we hold the alternates here.
  const photosByUrlRef = useRef<Map<string, Photo>>(new Map())
  if (photosByUrlRef.current.size === 0 && initialPhotos?.length) {
    for (const p of initialPhotos) {
      const primary = p.urls.imagekit ?? p.urls.cloudinary ?? p.urls.imgbb ?? p.urls.ghRelease
      if (primary) photosByUrlRef.current.set(primary, p)
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        // Strip what the v2 brief excludes from the floating bar — these
        // remain rendered if pasted, but the menu doesn't toggle them.
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Image.configure({ HTMLAttributes: { class: 'tt-img' } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Begin.' }),
    ],
    content: initialHtml || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const md = htmlToMd(html)
      const photoUrls = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m) => m[1])
      const photos = photoUrls
        .map((u) => photosByUrlRef.current.get(u))
        .filter((p): p is Photo => Boolean(p))
      onChange({ html, markdown: md, wordCount: countWords(editor.getText()), photoUrls, photos })
    },
    editorProps: {
      attributes: { class: 'tt-content entry-body', spellcheck: 'true' },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files
        if (!files || !files.length) return false
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
        if (!images.length) return false
        event.preventDefault()
        void (async () => {
          for (const file of images) {
            try {
              const { primaryUrl, photo } = await uploadPhotoForEditor(file)
              photosByUrlRef.current.set(primaryUrl, photo)
              editor?.chain().focus().setImage({ src: primaryUrl, alt: file.name }).run()
            } catch (e) {
              console.error('[photos] upload failed', e)
            }
          }
        })()
        return true
      },
    },
  })

  useEffect(() => {
    if (editor && initialHtml && !editor.isDestroyed && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml])

  if (!editor) return <div className="tt-skeleton" />

  const promptForLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previous ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="tt-shell">
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 0, animation: false }}
        shouldShow={({ editor, from, to }) => from !== to && !editor.isActive('image')}
      >
        <div className="tt-bubble" role="toolbar" aria-label="Formatting">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'on' : ''}
            aria-label="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'on' : ''}
            aria-label="Italic"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'on' : ''}
            aria-label="Heading"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'on' : ''}
            aria-label="Blockquote"
          >
            “
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'on' : ''}
            aria-label="Bullet list"
          >
            •
          </button>
          <button
            type="button"
            onClick={promptForLink}
            className={editor.isActive('link') ? 'on' : ''}
            aria-label="Link"
          >
            ↗
          </button>
        </div>
      </BubbleMenu>

      <EditorContent editor={editor} />

      <style>{`
        .tt-shell { display: block; }
        .tt-skeleton { min-height: 50vh; }

        .tt-bubble {
          display: inline-flex;
          gap: 0;
          background: var(--ink-black);
          border: 1px solid var(--rule);
          padding: 0;
          font-family: var(--font-sans);
        }
        .tt-bubble button {
          width: 32px;
          height: 32px;
          background: transparent;
          color: var(--page-cream);
          border: 0;
          border-right: 1px solid var(--rule);
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tt-bubble button:last-child { border-right: 0; }
        .tt-bubble button:hover,
        .tt-bubble button.on {
          color: var(--seal-red);
        }

        .tt-content {
          min-height: 60vh;
          padding: 0;
          background: transparent;
          border: 0;
          outline: none;
        }
        /* Body inherits .entry-body — no per-element overrides here. */
        .tt-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--graphite);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
