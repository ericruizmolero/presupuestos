'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import {
  Bold, Italic, List, ListOrdered, Quote, ImagePlus, Heading1, Heading2, Heading3, Pilcrow, Loader2,
} from 'lucide-react'
import { uploadTaskImage } from '@/lib/storage'
import { isHtml, plainToHtml } from './boardUtils'

interface Props {
  value: string
  companyId: string | null
  onChange: (html: string) => void
  /** Guardar al perder el foco (el padre decide cuándo persistir) */
  onBlur: () => void
}

/** Cuerpo de una tarea tipo Notion: títulos, listas, citas e imágenes (pegar, arrastrar o subir). */
export function TaskBodyEditor({ value, companyId, onChange, onBlur }: Props) {
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)

  async function insertImages(files: File[]) {
    const ed = editorRef.current
    if (!ed || !companyId) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setError('')
    setUploading((n) => n + images.length)
    for (const f of images) {
      try {
        const url = await uploadTaskImage(companyId, f)
        ed.chain().focus().setImage({ src: url, alt: f.name }).run()
      } catch (err) {
        console.error('[tarea] Error subiendo imagen:', err)
        setError('No se pudo subir la imagen. Prueba de nuevo.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Escribe aquí aclaraciones, contexto, enlaces… Pega o arrastra imágenes.' }),
    ],
    content: value ? (isHtml(value) ? value : plainToHtml(value)) : '',
    editorProps: {
      attributes: { class: 'task-body outline-none min-h-[12rem]' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.some((f) => f.type.startsWith('image/'))) { void insertImages(files); return true }
        return false
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? [])
        if (files.some((f) => f.type.startsWith('image/'))) { event.preventDefault(); void insertImages(files); return true }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
    onBlur: () => onBlur(),
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  if (!editor) return <div className="min-h-[12rem]" />

  const btn = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? 'bg-accent text-on-accent' : 'text-ink-60 hover:bg-surface-hover hover:text-ink'}`

  return (
    <div>
      {/* Barra de formato */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-0.5 bg-paper/95 backdrop-blur py-1.5 border-b border-line">
        <button type="button" title="Texto" className={btn(editor.isActive('paragraph'))} onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow size={14} strokeWidth={1.75} /></button>
        <button type="button" title="Título grande" className={btn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} strokeWidth={1.75} /></button>
        <button type="button" title="Título" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} strokeWidth={1.75} /></button>
        <button type="button" title="Subtítulo" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} strokeWidth={1.75} /></button>
        <span className="w-px h-4 bg-line mx-1" />
        <button type="button" title="Negrita" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} strokeWidth={2} /></button>
        <button type="button" title="Cursiva" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} strokeWidth={2} /></button>
        <span className="w-px h-4 bg-line mx-1" />
        <button type="button" title="Lista" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} strokeWidth={1.75} /></button>
        <button type="button" title="Lista numerada" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} strokeWidth={1.75} /></button>
        <button type="button" title="Cita" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} strokeWidth={1.75} /></button>
        <span className="w-px h-4 bg-line mx-1" />
        <button type="button" title="Insertar imagen" className={btn(false)} disabled={!companyId} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={15} strokeWidth={1.75} />
        </button>
        {uploading > 0 && (
          <span className="ml-2 flex items-center gap-1.5 text-xs text-ink-40">
            <Loader2 size={12} className="animate-spin" />
            Subiendo imagen…
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { void insertImages(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
      </div>
      {error && <p className="mb-2 text-xs text-[#B91C1C]">{error}</p>}
      <EditorContent editor={editor} />
    </div>
  )
}
