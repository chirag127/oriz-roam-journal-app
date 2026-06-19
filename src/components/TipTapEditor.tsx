/**
 * Tiptap-powered rich-text editor.
 * - StarterKit + Image + Link + Placeholder + TaskList
 * - Drag-drop image upload to Firebase Storage
 * - Returns `{ html, markdown, wordCount }` to the parent on every change (debounced)
 */
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useEffect, useRef } from 'react'
import { uploadPhoto } from '~/lib/photos'
import { htmlToMd } from '~/lib/markdown'
import { countWords } from '~/lib/journalDb'

interface Props {
  uid: string
  entryId: string
  initialHtml: string
  placeholder?: string
  onChange: (out: { html: string; markdown: string; wordCount: number; photoUrls: string[] }) => void
}

export default function TipTapEditor({ uid, entryId, initialHtml, placeholder, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ HTMLAttributes: { class: 'tt-img' } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialHtml || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const md = htmlToMd(html)
      const photoUrls = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m) => m[1])
      onChange({ html, markdown: md, wordCount: countWords(editor.getText()), photoUrls })
    },
    editorProps: {
      attributes: { class: 'tt-content', spellcheck: 'true' },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files
        if (!files || !files.length) return false
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
        if (!images.length) return false
        event.preventDefault()
        ;(async () => {
          for (const file of images) {
            try {
              const url = await uploadPhoto(uid, entryId, file)
              editor?.chain().focus().setImage({ src: url, alt: file.name }).run()
            } catch (e) { console.error('upload failed', e) }
          }
        })()
        return true
      },
    },
  })

  useEffect(() => {
    if (editor && initialHtml && !editor.isDestroyed && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml])

  if (!editor) return <div className="tt-skeleton">Loading editor…</div>

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const url = await uploadPhoto(uid, entryId, file)
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
      } catch (e) { console.error(e) }
    }
  }

  return (
    <div className="tt-shell">
      <div className="tt-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'tt-on' : ''}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'tt-on' : ''}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'tt-on' : ''}>H3</button>
        <span className="tt-sep" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'tt-on' : ''}><b>B</b></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'tt-on' : ''}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'tt-on' : ''}><s>S</s></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'tt-on' : ''}><code>{'<>'}</code></button>
        <span className="tt-sep" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'tt-on' : ''}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'tt-on' : ''}>1. List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={editor.isActive('taskList') ? 'tt-on' : ''}>☑ Tasks</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'tt-on' : ''}>“ Quote</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'tt-on' : ''}>{'</> Block'}</button>
        <span className="tt-sep" />
        <button type="button" onClick={() => fileInputRef.current?.click()}>📷 Image</button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .tt-shell { display: flex; flex-direction: column; gap: 0.5rem; }
        .tt-toolbar {
          display: flex; flex-wrap: wrap; gap: 0.25rem;
          padding: 0.375rem; background: var(--color-bg-soft);
          border: 1px solid var(--color-border); border-radius: var(--radius-button);
          position: sticky; top: 64px; z-index: 5; backdrop-filter: blur(8px);
        }
        .tt-toolbar button {
          background: transparent; color: var(--color-fg);
          border: 1px solid transparent; border-radius: 6px;
          padding: 0.25rem 0.5rem; font: inherit; font-size: 0.8125rem;
          cursor: pointer;
        }
        .tt-toolbar button:hover { background: var(--color-bg-muted); }
        .tt-toolbar .tt-on { background: var(--color-accent); color: var(--color-accent-fg); border-color: var(--color-accent); }
        .tt-sep { width: 1px; background: var(--color-border); margin-inline: 0.25rem; }
        .tt-content {
          min-height: 50vh;
          padding: 1.25rem;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-card);
          font-family: var(--font-serif);
          font-size: 1.0625rem;
          line-height: 1.7;
          color: var(--color-fg);
          outline: none;
        }
        .tt-content:focus { border-color: var(--color-accent); }
        .tt-content p { margin: 0 0 0.75rem; }
        .tt-content h1 { font-size: 1.625rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .tt-content h2 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .tt-content h3 { font-size: 1.0625rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .tt-content ul, .tt-content ol { padding-left: 1.5rem; margin: 0 0 0.75rem; }
        .tt-content blockquote { border-left: 3px solid var(--color-accent); padding-left: 1rem; margin: 0 0 0.75rem; color: var(--color-fg-muted); font-style: italic; }
        .tt-content code { background: var(--color-bg-muted); padding: 0.125em 0.375em; border-radius: 0.25rem; font-family: var(--font-mono); font-size: 0.875em; }
        .tt-content pre { background: var(--color-bg-muted); padding: 0.875rem; border-radius: var(--radius-button); overflow-x: auto; font-size: 0.875rem; }
        .tt-content pre code { background: none; padding: 0; }
        .tt-content .tt-img { max-width: 100%; border-radius: var(--radius-button); margin: 0.5rem 0; }
        .tt-content ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
        .tt-content ul[data-type="taskList"] li { display: flex; gap: 0.5rem; align-items: flex-start; }
        .tt-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); float: left; color: var(--color-fg-muted); pointer-events: none; height: 0;
        }
        .tt-skeleton { padding: 2rem; color: var(--color-fg-muted); text-align: center; }
      `}</style>
    </div>
  )
}
