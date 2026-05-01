'use client'

import { useState, useRef, useEffect } from 'react'
import * as Icons from 'react-feather'
import { Search, X } from 'lucide-react'

// All available Feather icons
const PHASE_ICONS = [
  'Activity', 'Airplay', 'AlertCircle', 'AlertOctagon', 'AlertTriangle',
  'AlignCenter', 'AlignJustify', 'AlignLeft', 'AlignRight', 'Anchor', 'Aperture',
  'Archive', 'ArrowDown', 'ArrowDownCircle', 'ArrowDownLeft', 'ArrowDownRight',
  'ArrowLeft', 'ArrowLeftCircle', 'ArrowRight', 'ArrowRightCircle', 'ArrowUp',
  'ArrowUpCircle', 'ArrowUpLeft', 'ArrowUpRight', 'AtSign', 'Award',
  'BarChart', 'BarChart2', 'Battery', 'BatteryCharging', 'Bell', 'BellOff',
  'Bluetooth', 'Bold', 'Book', 'BookOpen', 'Bookmark', 'Box', 'Briefcase',
  'Calendar', 'Camera', 'CameraOff', 'Cast', 'Check', 'CheckCircle', 'CheckSquare',
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp',
  'Chrome', 'Circle', 'Clipboard', 'Clock', 'Cloud', 'CloudDrizzle',
  'CloudLightning', 'CloudOff', 'CloudRain', 'CloudSnow', 'Code', 'Codepen',
  'Codesandbox', 'Coffee', 'Columns', 'Command', 'Compass', 'Copy', 'Cpu',
  'CreditCard', 'Crop', 'Crosshair', 'Database', 'Delete', 'Disc',
  'DollarSign', 'Download', 'DownloadCloud', 'Droplet', 'Edit', 'Edit2', 'Edit3',
  'ExternalLink', 'Eye', 'EyeOff', 'Facebook', 'FastForward', 'Feather',
  'Figma', 'File', 'FileMinus', 'FilePlus', 'FileText', 'Film', 'Filter',
  'Flag', 'Folder', 'FolderMinus', 'FolderPlus', 'Framer', 'Frown',
  'Gift', 'GitBranch', 'GitCommit', 'GitHub', 'GitMerge', 'GitPullRequest',
  'Gitlab', 'Globe', 'Grid', 'HardDrive', 'Hash', 'Headphones', 'Heart',
  'HelpCircle', 'Hexagon', 'Home', 'Image', 'Inbox', 'Info', 'Instagram',
  'Italic', 'Key', 'Layers', 'Layout', 'LifeBuoy', 'Link', 'Link2',
  'Linkedin', 'List', 'Loader', 'Lock', 'LogIn', 'LogOut', 'Mail', 'Map',
  'MapPin', 'Maximize', 'Maximize2', 'Meh', 'Menu', 'MessageCircle',
  'MessageSquare', 'Mic', 'MicOff', 'Minimize', 'Minimize2', 'Minus',
  'MinusCircle', 'MinusSquare', 'Monitor', 'Moon', 'MoreHorizontal',
  'MoreVertical', 'MousePointer', 'Move', 'Music', 'Navigation', 'Navigation2',
  'Octagon', 'Package', 'Paperclip', 'Pause', 'PauseCircle', 'PenTool',
  'Percent', 'Phone', 'PhoneCall', 'PhoneForwarded', 'PhoneIncoming',
  'PhoneMissed', 'PhoneOff', 'PhoneOutgoing', 'PieChart', 'Play', 'PlayCircle',
  'Plus', 'PlusCircle', 'PlusSquare', 'Pocket', 'Power', 'Printer',
  'Radio', 'RefreshCcw', 'RefreshCw', 'Repeat', 'Rewind', 'RotateCcw',
  'RotateCw', 'Rss', 'Save', 'Scissors', 'Search', 'Send', 'Server',
  'Settings', 'Share', 'Share2', 'Shield', 'ShieldOff', 'ShoppingBag',
  'ShoppingCart', 'Shuffle', 'Sidebar', 'SkipBack', 'SkipForward', 'Slack',
  'Sliders', 'Smartphone', 'Smile', 'Speaker', 'Square', 'Star', 'StopCircle',
  'Sun', 'Sunrise', 'Sunset', 'Table', 'Tablet', 'Tag', 'Target', 'Terminal',
  'Thermometer', 'ThumbsDown', 'ThumbsUp', 'ToggleLeft', 'ToggleRight',
  'Tool', 'Trash', 'Trash2', 'Trello', 'TrendingDown', 'TrendingUp',
  'Triangle', 'Truck', 'Tv', 'Twitch', 'Twitter', 'Type', 'Umbrella',
  'Underline', 'Unlock', 'Upload', 'UploadCloud', 'User', 'UserCheck',
  'UserMinus', 'UserPlus', 'UserX', 'Users', 'Video', 'VideoOff', 'Voicemail',
  'Volume', 'Volume1', 'Volume2', 'VolumeX', 'Watch', 'Wifi', 'WifiOff',
  'Wind', 'X', 'XCircle', 'XOctagon', 'XSquare', 'Youtube', 'Zap', 'ZapOff',
  'ZoomIn', 'ZoomOut',
]

interface Props {
  value?: string
  onChange: (icon: string | undefined) => void
}

export function FeatherIcon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>>)[name]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.5} className={className} />
}

export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((o) => !o)
  }

  const filtered = search
    ? PHASE_ICONS.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : PHASE_ICONS

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-9 h-9 flex items-center justify-center rounded-md border transition-colors ${
          value
            ? 'border-accent bg-accent text-on-accent'
            : 'border-input text-ink-40 hover:border-accent hover:text-ink'
        }`}
        title="Elegir icono"
      >
        {value ? <FeatherIcon name={value} size={15} /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
          </svg>
        )}
      </button>

      {open && pos && (
        <div
          ref={popupRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50 }}
          className="w-72 bg-paper border border-line rounded-md shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05)] overflow-hidden"
        >
          <div className="p-2 border-b border-line flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-surface rounded px-3 py-1.5">
              <Search size={12} className="text-ink-40 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar icono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none text-ink placeholder-ink-40"
              />
            </div>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false) }}
                className="p-1.5 text-ink-40 hover:text-[#DC2626] transition-colors"
                title="Quitar icono"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-0 p-2 max-h-56 overflow-y-auto">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => { onChange(name); setOpen(false); setSearch('') }}
                title={name}
                className={`p-2 rounded flex items-center justify-center transition-colors ${
                  value === name
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-60 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <FeatherIcon name={name} size={15} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-8 text-center text-xs text-ink-40 py-4">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
