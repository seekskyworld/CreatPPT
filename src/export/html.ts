import type { DeckSpec } from '@/domain/types'

export async function buildHtmlBlob(deck: DeckSpec): Promise<Blob> {
  const jsonStr = JSON.stringify(deck, null, 2)
  const title = deck.title || 'Presentation'

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; }
    .deck-container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .deck-header { text-align: center; margin-bottom: 40px; }
    .deck-title { font-size: 36px; font-weight: 800; margin-bottom: 8px; color: #38bdf8; }
    .deck-subtitle { font-size: 18px; color: #94a3b8; }
    .slide-card { background: #1e293b; border-radius: 12px; margin-bottom: 32px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); border: 1px solid #334155; }
    .slide-number { font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; tracking: 0.1em; margin-bottom: 8px; }
    .slide-title { font-size: 28px; font-weight: 700; margin-bottom: 12px; color: #f8fafc; }
    .slide-subtitle { font-size: 16px; color: #cbd5e1; margin-bottom: 16px; }
    .slide-body { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
    .elements-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }
    .element-card { background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #334155; }
    .element-type { font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: 700; margin-bottom: 4px; }
    .element-content { font-size: 14px; color: #e2e8f0; word-break: break-word; }
    .interactive-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #0284c7; color: #fff; font-size: 11px; font-weight: 600; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="deck-container">
    <header class="deck-header">
      <h1 class="deck-title">${escapeHtml(deck.title)}</h1>
      ${deck.subtitle ? `<p class="deck-subtitle">${escapeHtml(deck.subtitle)}</p>` : ''}
    </header>

    <main id="slides-root">
      ${deck.slides.map((slide, index) => `
        <article class="slide-card" id="slide-${slide.id}">
          <div class="slide-number">Slide ${index + 1} / ${deck.slides.length} <span class="interactive-badge">${slide.layout}</span></div>
          <h2 class="slide-title">${escapeHtml(slide.title)}</h2>
          ${slide.subtitle ? `<p class="slide-subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
          ${slide.body ? `<p class="slide-body">${escapeHtml(slide.body)}</p>` : ''}

          ${slide.elements && slide.elements.length > 0 ? `
            <div class="elements-grid">
              ${slide.elements.map(elem => `
                <div class="element-card">
                  <div class="element-type">${elem.type} ${elem.action ? '⚡ (Action)' : ''}</div>
                  <div class="element-content">
                    ${elem.text ? escapeHtml(elem.text) : ''}
                    ${elem.src ? `<img src="${escapeHtml(elem.src)}" style="max-width:100%; border-radius:4px; margin-top:8px;" />` : ''}
                    ${elem.table ? `<table>${elem.table.headers ? `<tr>${elem.table.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>` : ''}${elem.table.rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('')}</table>` : ''}
                    ${elem.chart ? `<div>Chart: ${elem.chart.points.map(p => `${p.label}: ${p.value}`).join(', ')}</div>` : ''}
                    ${elem.form ? `<form>${elem.form.fields.map(f => `<div style="margin:4px 0;"><label>${escapeHtml(f.label)}: </label><input type="${f.type}" /></div>`).join('')}</form>` : ''}
                    ${elem.embed ? `<a href="${escapeHtml(elem.embed.url)}" target="_blank" style="color:#38bdf8;">${escapeHtml(elem.embed.url)}</a>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </article>
      `).join('')}
    </main>
  </div>

  <script>
    window.__DECK_DATA__ = ${jsonStr};
  </script>
</body>
</html>`

  return new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
}

export async function exportDeckToHtml(deck: DeckSpec): Promise<void> {
  const blob = await buildHtmlBlob(deck)
  downloadBlob(blob, `${safeFileName(deck.title)}.html`)
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
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
