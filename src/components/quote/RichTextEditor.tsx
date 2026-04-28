'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'

import { Bold, Italic, UnderlineIcon, List, ListOrdered, AlignLeft, AlignCenter } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

export function RichTextEditor({ value, onChange, placeholder = 'Escribe aquí...', minHeight = '80px' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
        style: `min-height: ${minHeight}; padding: 12px 16px;`,
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) return null

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover hover:text-ink'
    }`

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:border-accent focus-within:ring-[3px] focus-within:ring-black/[0.06] transition-colors">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-line bg-surface">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))}>
          <Bold size={13} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))}>
          <Italic size={13} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))}>
          <UnderlineIcon size={13} strokeWidth={2} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))}>
          <List size={13} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))}>
          <ListOrdered size={13} strokeWidth={2} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))}>
          <AlignLeft size={13} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))}>
          <AlignCenter size={13} strokeWidth={2} />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
