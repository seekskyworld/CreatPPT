import type { DeckSpec } from '@/domain/types'
import { buildHtmlBlob } from './html'

export async function buildPdfBlob(deck: DeckSpec): Promise<Blob> {
  // Build PDF printable blob or document stream
  const htmlBlob = await buildHtmlBlob(deck)
  const htmlText = await htmlBlob.text()

  const pdfHtml = htmlText.replace('</head>', `
  <style>
    @media print {
      body { background: #fff !important; color: #000 !important; }
      .slide-card { page-break-after: always; break-after: page; border: none !important; box-shadow: none !important; background: #fff !important; color: #000 !important; }
    }
  </style>
  </head>`)

  return new Blob([pdfHtml], { type: 'application/pdf' })
}

export async function exportDeckToPdf(deck: DeckSpec): Promise<void> {
  if (typeof window !== 'undefined' && window.print) {
    window.print()
  } else {
    const blob = await buildPdfBlob(deck)
    downloadBlob(blob, `${safeFileName(deck.title)}.pdf`)
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function safeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) || 'presentation'
}
