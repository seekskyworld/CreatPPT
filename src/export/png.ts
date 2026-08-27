import JSZip from 'jszip'
import type { DeckSpec } from '@/domain/types'

export async function buildPngZipBlob(deck: DeckSpec): Promise<Blob> {
  const zip = new JSZip()

  deck.slides.forEach((slide, index) => {
    const slideNumber = String(index + 1).padStart(2, '0')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <rect width="1600" height="900" fill="#0f172a"/>
      <text x="80" y="100" font-family="sans-serif" font-size="48" font-weight="bold" fill="#f8fafc">${escapeXml(slide.title)}</text>
      ${slide.subtitle ? `<text x="80" y="160" font-family="sans-serif" font-size="24" fill="#94a3b8">${escapeXml(slide.subtitle)}</text>` : ''}
      ${slide.body ? `<text x="80" y="240" font-family="sans-serif" font-size="20" fill="#cbd5e1">${escapeXml(slide.body)}</text>` : ''}
      <text x="1450" y="850" font-family="sans-serif" font-size="18" fill="#64748b">${slideNumber} / ${String(deck.slides.length).padStart(2, '0')}</text>
    </svg>`

    zip.file(`slide_${slideNumber}.svg`, svg)
  })

  return await zip.generateAsync({ type: 'blob' })
}

export async function exportDeckToPng(deck: DeckSpec): Promise<void> {
  const blob = await buildPngZipBlob(deck)
  downloadBlob(blob, `${safeFileName(deck.title)}-pngs.zip`)
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
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
