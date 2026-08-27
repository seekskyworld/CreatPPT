import type { DeckSpec } from '@/domain/types'

/** Keep image IDs stable and unique when users edit or duplicate media. */
export function normalizeImageAssetIds(deck: DeckSpec): void {
  const sourceById = new Map<string, string>()
  const usedIds = new Set<string>()
  deck.slides.forEach((slide) => {
    slide.images?.forEach((image, index) => {
      const source = image.src
      let assetId = image.assetId
      if (!assetId || (sourceById.has(assetId) && sourceById.get(assetId) !== source)) {
        const base = `${slide.id}-image-${index + 1}`
        assetId = base
        let suffix = 2
        while (usedIds.has(assetId) || (sourceById.has(assetId) && sourceById.get(assetId) !== source)) {
          assetId = `${base}-${suffix++}`
        }
        image.assetId = assetId
      }
      sourceById.set(assetId, source)
      usedIds.add(assetId)
    })
  })
}

/** Ensure the selected candidate always belongs to the slide's active layout. */
export function normalizeSelectedLayoutCandidates(deck: DeckSpec): void {
  deck.slides.forEach((slide) => {
    const selected = slide.layoutCandidates?.find(candidate => candidate.id === slide.selectedLayoutCandidate)
    if (selected?.layout === slide.layout) return
    slide.selectedLayoutCandidate = slide.layoutCandidates?.find(candidate => candidate.layout === slide.layout)?.id
  })
}
