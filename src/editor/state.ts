import { computed, ref } from 'vue'
import { applyTemplateImages, createStarterDeck } from '@/demo/starter'
import { clampElementGeometry, ensureDeckElements, rebuildSlideElements, refreshSlideElementBindings } from '@/domain/elements'
import { getAtPath, setAtPath } from '@/domain/path'
import { inspectDeck } from '@/domain/quality'
import { parseDeck } from '@/domain/schema'
import { elementTypeLabel, translate } from '@/i18n'
import { cloneSnapshot } from '@/editor/history'
import { normalizeImageAssetIds, normalizeSelectedLayoutCandidates } from '@/editor/persistence'
import type { AlignmentGuide, DeckSpec, EditorSelection, ElementStyle, SlideElement, SlideElementType, SlideLayout, SlideSpec, TemplateId, TweakState } from '@/domain/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const deck = ref<DeckSpec>(createStarterDeck())
const loaded = ref(false)
const loadError = ref('')
const currentSlideId = ref('')
const selection = ref<EditorSelection | null>(null)
const saveState = ref<SaveState>('idle')
const presentation = ref(false)
const mobilePanel = ref<'slides' | 'canvas' | 'inspector'>('canvas')
const notices = ref<Array<{ id: number; tone: 'success' | 'error' | 'info'; message: string }>>([])

const past: DeckSpec[] = []
const future: DeckSpec[] = []
let saveTimer: ReturnType<typeof setTimeout> | undefined
let noticeId = 0
type ElementInteractionMode = 'move' | 'resize' | 'rotate'
type ElementAlignCommand = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
let transientInteraction: {
  before: DeckSpec
  slideId: string
  elementId: string
  elementIds: string[]
  mode: ElementInteractionMode
  initial: Record<string, Pick<SlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>>
  changed: boolean
} | undefined
const alignmentGuides = ref<AlignmentGuide[]>([])

const currentSlide = computed(() => deck.value.slides.find(slide => slide.id === currentSlideId.value) ?? deck.value.slides[0])
const currentIndex = computed(() => deck.value.slides.findIndex(slide => slide.id === currentSlide.value?.id))
const qualityIssues = computed(() => inspectDeck(deck.value))
const canUndo = computed(() => past.length > 0)
const canRedo = computed(() => future.length > 0)
const selectedElementIds = computed(() => {
  const current = selection.value
  if (!current?.elementId) return []
  return current.elementIds?.length ? current.elementIds : [current.elementId]
})

export function useEditorState() {
  async function load() {
    try {
      const response = await fetch('/api/deck', { cache: 'no-store' })
      if (!response.ok) throw new Error(`Unable to load deck (${response.status}).`)
      deck.value = parseDeck(await response.json())
      let migrated = ensureDeckElements(deck.value)
      deck.value.slides.forEach(slide => {
        migrated = refreshSlideElementBindings(slide, deck.value.templateId) || migrated
        if (slide.elements !== undefined) {
          const before = JSON.stringify(slide.elements)
          rebuildSlideElements(slide, deck.value.templateId)
          migrated = JSON.stringify(slide.elements) !== before || migrated
          migrated = refreshSlideElementBindings(slide, deck.value.templateId) || migrated
        }
      })
      if (migrated) scheduleSave()
      localStorage.setItem(`creatppt:${deck.value.id}`, JSON.stringify(deck.value))
    }
    catch (error) {
      loadError.value = error instanceof Error ? error.message : String(error)
      const cached = findCachedDeck()
      if (cached) {
        deck.value = cached
        notify('info', translate('notify.recentVersion'))
      }
    }
    currentSlideId.value = deck.value.slides[0]?.id ?? ''
    loaded.value = true
  }

  function commit(change: () => void) {
    past.push(cloneSnapshot(deck.value))
    if (past.length > 60) past.shift()
    future.length = 0
    change()
    deck.value.updatedAt = new Date().toISOString()
    deck.value = cloneSnapshot(deck.value)
    scheduleSave()
  }

  function updateValue(slideId: string, path: string, value: unknown) {
    const slide = deck.value.slides.find(item => item.id === slideId)
    if (!slide || getAtPath(slide, path) === value) return
    commit(() => {
      setAtPath(slide, path, value)
      refreshSlideElementBindings(slide, deck.value.templateId)
    })
  }

  function updateDesignContext(path: string, value: unknown) {
    const current = deck.value.designContext ? getAtPath(deck.value.designContext, path) : undefined
    if (current === value) return
    commit(() => {
      if (!deck.value.designContext) deck.value.designContext = {}
      setAtPath(deck.value.designContext as Record<string, unknown>, path, value)
    })
  }

  function setTemplate(templateId: TemplateId) {
    if (deck.value.templateId === templateId) return
    commit(() => {
      deck.value.templateId = templateId
      applyTemplateImages(deck.value.slides, templateId, true)
      deck.value.slides.forEach(slide => {
        if (slide.elements !== undefined) rebuildSlideElements(slide, templateId)
        refreshSlideElementBindings(slide, templateId)
      })
      syncAssetManifest()
    })
  }

  function updateTweaks(patch: Partial<TweakState>) {
    const current: TweakState = deck.value.tweaks ?? {
      density: 'balanced',
      fontScale: 1,
      accentMode: 'default',
    }
    const next = { ...current, ...patch }
    if (next.fontScale < 0.85 || next.fontScale > 1.2) return
    commit(() => { deck.value.tweaks = next })
  }

  function setLayout(layout: SlideLayout) {
    const slide = currentSlide.value
    if (!slide || slide.layout === layout) return
    commit(() => {
      slide.layout = layout
      const candidate = slide.layoutCandidates?.find(item => item.layout === layout)
      if (candidate) slide.selectedLayoutCandidate = candidate.id
      hydrateLayout(slide, layout)
      rebuildSlideElements(slide, deck.value.templateId)
    })
    selection.value = null
  }

  function setLayoutCandidate(candidateId: string) {
    const slide = currentSlide.value
    const candidate = slide?.layoutCandidates?.find(item => item.id === candidateId)
    if (!slide || !candidate || slide.selectedLayoutCandidate === candidate.id) return
    commit(() => {
      slide.layout = candidate.layout
      slide.layoutFamily = candidate.family
      slide.selectedLayoutCandidate = candidate.id
      hydrateLayout(slide, candidate.layout)
      rebuildSlideElements(slide, deck.value.templateId)
    })
    selection.value = null
  }

  function updateDeckTitle(title: string) {
    const value = title.trim()
    if (!value || value === deck.value.title) return
    commit(() => { deck.value.title = value })
  }

  function selectSlide(id: string) {
    currentSlideId.value = id
    selection.value = null
    alignmentGuides.value = []
    mobilePanel.value = 'canvas'
  }

  function setSelection(value: EditorSelection | null) {
    if (value?.elementId) {
      const ids = value.elementIds?.length ? [...new Set(value.elementIds)] : [value.elementId]
      value = { ...value, elementIds: ids }
    }
    selection.value = value
    if (!value) alignmentGuides.value = []
    if (value && window.innerWidth < 860) mobilePanel.value = 'inspector'
  }

  function findElement(slideId: string, elementId: string): SlideElement | undefined {
    return findElementInDeck(deck.value, slideId, elementId)
  }

  function selectedElement(): { slide: SlideSpec; element: SlideElement } | undefined {
    const currentSelection = selection.value
    if (!currentSelection?.elementId) return undefined
    const slide = deck.value.slides.find(item => item.id === currentSelection.slideId)
    const element = slide?.elements?.find(item => item.id === currentSelection.elementId)
    return slide && element ? { slide, element } : undefined
  }

  function selectElement(slideId: string, elementId: string, additive = false) {
    const slide = deck.value.slides.find(item => item.id === slideId)
    const element = slide?.elements?.find(item => item.id === elementId)
    if (!slide || !element) return
    const current = selection.value?.kind === 'element' && selection.value.slideId === slideId
      ? selectedElementIds.value
      : []
    const alreadySelected = current.includes(elementId)
    let ids = !additive && alreadySelected ? [...current] : additive ? [...current] : [elementId]
    if (additive && ids.includes(elementId)) ids = ids.filter(id => id !== elementId)
    else if (additive) ids.push(elementId)
    if (!ids.length) {
      setSelection(null)
      return
    }
    const primaryId = ids.includes(elementId) ? elementId : ids[ids.length - 1]
    const primary = slide.elements?.find(item => item.id === primaryId)
    if (!primary) return
    setSelection({
      slideId,
      kind: 'element',
      path: `elements.${primaryId}`,
      elementId: primaryId,
      elementIds: ids,
      label: ids.length > 1 ? translate('element.selectionCount', { count: ids.length }) : elementLabel(primary),
    })
  }

  function selectElements(slideId: string, elementIds: string[], additive = false) {
    const slide = deck.value.slides.find(item => item.id === slideId)
    if (!slide?.elements?.length) return
    const validIds = [...new Set(elementIds)].filter(id => slide.elements?.some(element => element.id === id && !element.locked && element.visible !== false))
    const current = additive && selection.value?.kind === 'element' && selection.value.slideId === slideId
      ? selectedElementIds.value
      : []
    const ids = [...new Set([...current, ...validIds])]
    const primaryId = validIds[validIds.length - 1] ?? current[current.length - 1]
    if (!primaryId || !ids.length) {
      setSelection(null)
      return
    }
    const primary = slide.elements.find(element => element.id === primaryId)
    if (!primary) return
    setSelection({
      slideId,
      kind: 'element',
      path: `elements.${primary.id}`,
      elementId: primary.id,
      elementIds: ids,
      label: ids.length > 1 ? translate('element.selectionCount', { count: ids.length }) : elementLabel(primary),
    })
  }

  function beginElementInteraction(slideId: string, elementId: string, mode: ElementInteractionMode = 'move', duplicate = false): string {
    const slide = deck.value.slides.find(item => item.id === slideId)
    let element = slide?.elements?.find(item => item.id === elementId)
    if (!slide || !element || element.locked) return elementId
    const before = cloneSnapshot(deck.value)
    let activeElementId = elementId
    let ids = selectedElementIds.value.includes(elementId) ? selectedElementIds.value : [elementId]
    if (duplicate && mode === 'move') {
      const sourceIds = ids
      const idMap = new Map<string, string>()
      const clones = (slide.elements ?? [])
        .filter(item => sourceIds.includes(item.id) && !item.locked)
        .map((item, index) => {
          const clone = cloneSnapshot(item)
          clone.id = `${item.id}-drag-${Date.now().toString(36)}-${index}`
          clone.userEdited = true
          idMap.set(item.id, clone.id)
          return clone
        })
      if (clones.length) {
        slide.elements ||= []
        slide.elements.push(...clones)
        activeElementId = idMap.get(elementId) ?? clones[0].id
        ids = clones.map(clone => clone.id)
        element = clones.find(clone => clone.id === activeElementId) ?? clones[0]
        selectElements(slideId, ids)
      }
    }
    const initial: Record<string, Pick<SlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>> = {}
    ids.forEach(id => {
      const target = slide.elements?.find(item => item.id === id)
      if (target && !target.locked && target.visible !== false) initial[id] = { x: target.x, y: target.y, width: target.width, height: target.height, rotation: target.rotation }
    })
    transientInteraction = { before, slideId, elementId: activeElementId, elementIds: Object.keys(initial), mode, initial, changed: false }
    return activeElementId
  }

  function updateElementGeometry(slideId: string, elementId: string, geometry: Pick<SlideElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>) {
    const element = findElement(slideId, elementId)
    if (!element || element.locked) return
    const next = clampElementGeometry(geometry)
    if (element.x === next.x && element.y === next.y && element.width === next.width && element.height === next.height && element.rotation === next.rotation) return
    if (!transientInteraction || transientInteraction.slideId !== slideId || transientInteraction.elementId !== elementId) {
      commit(() => Object.assign(element, next, { userEdited: true }))
      return
    }
    const interaction = transientInteraction
    if (interaction.mode === 'move' && interaction.elementIds.length > 1) {
      const origin = interaction.initial[elementId]
      const dx = next.x - (origin?.x ?? element.x)
      const dy = next.y - (origin?.y ?? element.y)
      interaction.elementIds.forEach(id => {
        const target = findElement(slideId, id)
        const initial = interaction.initial[id]
        if (!target || !initial) return
        const moved = id === elementId ? next : clampElementGeometry({
          x: initial.x + dx,
          y: initial.y + dy,
          width: initial.width,
          height: initial.height,
          rotation: initial.rotation,
        })
        Object.assign(target, moved, { userEdited: true })
      })
    }
    else Object.assign(element, next, { userEdited: true })
    interaction.changed = true
    deck.value = cloneSnapshot(deck.value)
  }

  function endElementInteraction() {
    const interaction = transientInteraction
    transientInteraction = undefined
    alignmentGuides.value = []
    if (!interaction?.changed) return
    past.push(interaction.before)
    if (past.length > 60) past.shift()
    future.length = 0
    deck.value.updatedAt = new Date().toISOString()
    scheduleSave()
  }

  function cancelElementInteraction() {
    if (!transientInteraction) return
    deck.value = transientInteraction.before
    transientInteraction = undefined
    alignmentGuides.value = []
    selection.value = null
  }

  function setAlignmentGuides(guides: AlignmentGuide[]) {
    alignmentGuides.value = guides
  }

  function updateElementText(slideId: string, elementId: string, text: string) {
    updateElement(slideId, elementId, { text, userEdited: true })
  }

  function updateElementStyle(slideId: string, elementId: string, style: Partial<ElementStyle>) {
    const element = findElement(slideId, elementId)
    if (!element) return
    updateElement(slideId, elementId, { style: { ...(element.style ?? {}), ...style }, userEdited: true })
  }

  function updateElement(slideId: string, elementId: string, patch: Partial<SlideElement>) {
    const element = findElement(slideId, elementId)
    const slide = deck.value.slides.find(item => item.id === slideId)
    const unlocking = element?.locked && patch.locked === false && Object.keys(patch).every(key => key === 'locked')
    // A locked object can only receive the explicit unlock command; all other
    // content and geometry updates remain blocked until it is unlocked.
    if (!element || !slide || (element.locked && !unlocking)) return
    commit(() => {
      Object.assign(element, patch)
      if (element.path && patch.text !== undefined && element.type === 'text') setAtPath(slide, element.path, patch.text)
      if (element.path && patch.src !== undefined && element.type === 'image') setAtPath(slide, `${element.path}.src`, patch.src)
      if (element.path && patch.alt !== undefined && element.type === 'image') setAtPath(slide, `${element.path}.alt`, patch.alt)
    })
  }

  function addElement(type: SlideElementType, position?: { x: number; y: number }, content?: { text?: string; src?: string; alt?: string }) {
    const slide = currentSlide.value
    if (!slide) return
    const draft = makeElement(type, slide.id, (slide.elements?.length ?? 0) + 1, position, content)
    const element = { ...draft, ...clampElementGeometry(draft) }
    commit(() => {
      slide.elements ||= []
      slide.elements.push(element)
    })
    selectElement(slide.id, element.id)
  }

  function addElementAt(type: SlideElementType, position: { x: number; y: number }, content?: { text?: string; src?: string; alt?: string }) {
    addElement(type, position, content)
  }

  function deleteSelectedElement() {
    const target = selectedElement()
    if (!target) return
    const ids = selectedElementIds.value
    commit(() => {
      const elements = target.slide.elements ?? []
      target.slide.elements = elements.filter(element => !ids.includes(element.id) || element.locked)
    })
    selection.value = null
  }

  function duplicateSelectedElement() {
    const target = selectedElement()
    if (!target) return
    const ids = selectedElementIds.value
    const clones = (target.slide.elements ?? [])
      .filter(element => ids.includes(element.id) && !element.locked)
      .map((element, index) => {
        const clone = cloneSnapshot(element)
        clone.id = `${element.id}-copy-${Date.now().toString(36)}-${index}`
        clone.x = Math.min(1600 - clone.width, clone.x + 32)
        clone.y = Math.min(900 - clone.height, clone.y + 32)
        clone.userEdited = true
        clone.zIndex = Math.max(0, (clone.zIndex ?? 0) + 1)
        return clone
      })
    if (!clones.length) return
    commit(() => {
      target.slide.elements ||= []
      target.slide.elements.push(...clones)
    })
    selectElements(target.slide.id, clones.map(clone => clone.id))
  }

  function changeElementZIndex(delta: number) {
    const target = selectedElement()
    if (!target || target.element.locked) return
    commit(() => {
      const elements = target.slide.elements ?? []
      const max = Math.max(0, ...elements.map(element => element.zIndex ?? 0))
      elements.forEach(element => {
        if (!selectedElementIds.value.includes(element.id) || element.locked) return
        element.zIndex = Math.max(0, Math.min(10000, (element.zIndex ?? max) + delta))
        element.userEdited = true
      })
    })
  }

  function alignSelectedElements(command: ElementAlignCommand) {
    const slide = currentSlide.value
    if (!slide) return
    const targets = (slide.elements ?? []).filter(element => selectedElementIds.value.includes(element.id) && !element.locked)
    if (!targets.length) return
    commit(() => {
      targets.forEach(element => {
        const x = command === 'left' ? 0 : command === 'centerX' ? (1600 - element.width) / 2 : command === 'right' ? 1600 - element.width : element.x
        const y = command === 'top' ? 0 : command === 'centerY' ? (900 - element.height) / 2 : command === 'bottom' ? 900 - element.height : element.y
        Object.assign(element, clampElementGeometry({ x, y, width: element.width, height: element.height, rotation: element.rotation }), { userEdited: true })
      })
    })
  }

  function nudgeSelectedElement(dx: number, dy: number) {
    const target = selectedElement()
    if (!target || target.element.locked) return
    const ids = selectedElementIds.value
    const targets = (target.slide.elements ?? []).filter(element => ids.includes(element.id) && !element.locked)
    if (!targets.length) return
    commit(() => {
      targets.forEach(element => Object.assign(element, clampElementGeometry({
        x: element.x + dx,
        y: element.y + dy,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
      }), { userEdited: true }))
    })
  }

  function selectAllElements() {
    const slide = currentSlide.value
    if (!slide) return
    selectElements(slide.id, (slide.elements ?? []).filter(element => !element.locked && element.visible !== false).map(element => element.id))
  }

  function addSlide() {
    const newSlide = makeSlide('statement')
    const index = Math.max(currentIndex.value + 1, deck.value.slides.length)
    commit(() => deck.value.slides.splice(index, 0, newSlide))
    currentSlideId.value = newSlide.id
    selection.value = null
  }

  function duplicateSlide() {
    const slide = currentSlide.value
    if (!slide) return
    const clone = cloneSnapshot(slide)
    clone.id = uniqueId('slide')
    const index = currentIndex.value + 1
    commit(() => deck.value.slides.splice(index, 0, clone))
    currentSlideId.value = clone.id
  }

  function deleteSlide() {
    if (deck.value.slides.length <= 1) {
      notify('info', translate('notify.keepOneSlide'))
      return
    }
    const index = currentIndex.value
    commit(() => deck.value.slides.splice(index, 1))
    currentSlideId.value = deck.value.slides[Math.min(index, deck.value.slides.length - 1)].id
    selection.value = null
  }

  function moveSlide(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= deck.value.slides.length || toIndex >= deck.value.slides.length) return
    commit(() => {
      const [slide] = deck.value.slides.splice(fromIndex, 1)
      deck.value.slides.splice(toIndex, 0, slide)
    })
  }

  function undo() {
    const snapshot = past.pop()
    if (!snapshot) return
    future.push(cloneSnapshot(deck.value))
    deck.value = snapshot
    ensureCurrentSlide()
    selection.value = null
    scheduleSave()
  }

  function redo() {
    const snapshot = future.pop()
    if (!snapshot) return
    past.push(cloneSnapshot(deck.value))
    deck.value = snapshot
    ensureCurrentSlide()
    selection.value = null
    scheduleSave()
  }

  async function saveNow(): Promise<boolean> {
    if (saveTimer) clearTimeout(saveTimer)
    saveState.value = 'saving'
    try {
      normalizeImageAssetIds(deck.value)
      normalizeSelectedLayoutCandidates(deck.value)
      syncAssetManifest()
      const serialized = JSON.stringify(deck.value)
      localStorage.setItem(`creatppt:${deck.value.id}`, serialized)
      const response = await fetch('/api/deck', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck.value),
      })
      if (!response.ok) {
        let detail = ''
        try {
          const payload = await response.json() as { error?: string }
          detail = payload.error ? `: ${payload.error}` : ''
        }
        catch {
          // Keep the status-only message when the server did not return JSON.
        }
        throw new Error(`Save failed (${response.status})${detail}.`)
      }
      const result = await response.json() as { updatedAt?: string }
      if (result.updatedAt) deck.value.updatedAt = result.updatedAt
      saveState.value = 'saved'
      setTimeout(() => {
        if (saveState.value === 'saved') saveState.value = 'idle'
      }, 1800)
      return true
    }
    catch (error) {
      saveState.value = 'error'
      notify('error', error instanceof Error ? error.message : translate('notify.saveFailed'))
      return false
    }
  }

  function scheduleSave() {
    saveState.value = 'saving'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 650)
  }

  function notify(tone: 'success' | 'error' | 'info', message: string) {
    const id = ++noticeId
    notices.value.push({ id, tone, message })
    setTimeout(() => {
      notices.value = notices.value.filter(notice => notice.id !== id)
    }, 3600)
  }

  return {
    deck,
    loaded,
    loadError,
    currentSlideId,
    currentSlide,
    currentIndex,
    selection,
    selectedElementIds,
    alignmentGuides,
    saveState,
    presentation,
    mobilePanel,
    notices,
    qualityIssues,
    canUndo,
    canRedo,
    load,
    updateValue,
    updateDesignContext,
    updateDeckTitle,
    setTemplate,
    updateTweaks,
    setLayout,
    setLayoutCandidate,
    selectSlide,
    setSelection,
    selectElement,
    selectElements,
    selectedElement,
    beginElementInteraction,
    updateElementGeometry,
    endElementInteraction,
    cancelElementInteraction,
    setAlignmentGuides,
    updateElementText,
    updateElementStyle,
    updateElement,
    addElement,
    addElementAt,
    deleteSelectedElement,
    duplicateSelectedElement,
    changeElementZIndex,
    alignSelectedElements,
    nudgeSelectedElement,
    selectAllElements,
    addSlide,
    duplicateSlide,
    deleteSlide,
    moveSlide,
    undo,
    redo,
    saveNow,
    notify,
  }
}

function hydrateLayout(slide: SlideSpec, layout: SlideLayout) {
  const defaults = makeSlide(layout)
  if (layout === 'metrics' && !slide.stats?.length) slide.stats = defaults.stats
  if (layout === 'comparison' && !slide.columns?.length) slide.columns = defaults.columns
  if (layout === 'timeline' && !slide.steps?.length) slide.steps = defaults.steps
  if (layout === 'chart' && !slide.chart) slide.chart = defaults.chart
  if (layout === 'gallery' && !slide.images?.length) slide.images = defaults.images
  if (layout === 'quote' && !slide.quote) {
    slide.quote = defaults.quote
    slide.quoteBy = defaults.quoteBy
  }
}

function findElementInDeck(source: DeckSpec, slideId: string, elementId: string): SlideElement | undefined {
  return source.slides.find(slide => slide.id === slideId)?.elements?.find(element => element.id === elementId)
}

function elementLabel(element: SlideElement): string {
  return elementTypeLabel(element.type)
}

function makeElement(type: SlideElementType, slideId: string, order: number, position?: { x: number; y: number }, content?: { text?: string; src?: string; alt?: string }): SlideElement {
  const id = `${slideId}:custom-${type}-${Date.now().toString(36)}-${order}`
  const common = { id, type, x: position?.x ?? 520, y: position?.y ?? 330, width: 360, height: 120, zIndex: 100 + order, userEdited: true }
  if (type === 'text') return { ...common, text: content?.text ?? (translate('element.text') === 'Text' ? 'New text box' : '新的文本框'), style: { color: 'var(--slide-ink)', fontSize: 34, fontWeight: 700, lineHeight: 1.25 } }
  if (type === 'image') return { ...common, width: 420, height: 260, src: content?.src ?? 'assets/studio-product-still-life.jpg', alt: content?.alt ?? translate('slide.image'), style: { objectFit: 'cover', stroke: 'var(--slide-line)', strokeWidth: 1 } }
  if (type === 'ellipse') return { ...common, width: 220, height: 160, style: { fill: 'var(--slide-accent-alt)', radius: 100 } }
  if (type === 'line' || type === 'arrow') return { ...common, width: 360, height: 4, style: { fill: 'var(--slide-accent)', stroke: 'var(--slide-accent)', strokeWidth: 3 } }
  return { ...common, style: { fill: 'var(--slide-accent)', stroke: 'var(--slide-line)', strokeWidth: 1, radius: 8 } }
}

function makeSlide(layout: SlideLayout): SlideSpec {
  return {
    id: uniqueId('slide'),
    layout,
    eyebrow: translate('newSlide.eyebrow'),
    title: translate('newSlide.title'),
    body: translate('newSlide.body'),
    bullets: [translate('newSlide.bullet.1'), translate('newSlide.bullet.2'), translate('newSlide.bullet.3')],
    stats: [
      { value: '42%', label: translate('newSlide.metric.label'), detail: translate('newSlide.metric.detail') },
      { value: '2.4x', label: translate('newSlide.metric.label'), detail: translate('newSlide.metric.detail') },
      { value: '18', label: translate('newSlide.metric.label'), detail: translate('newSlide.metric.detail') },
    ],
    columns: [
      { title: translate('newSlide.column.a'), body: translate('newSlide.column.body'), bullets: [translate('newSlide.column.bullet.1'), translate('newSlide.column.bullet.2')] },
      { title: translate('newSlide.column.b'), body: translate('newSlide.column.body'), bullets: [translate('newSlide.column.bullet.1'), translate('newSlide.column.bullet.2')] },
    ],
    steps: [
      { label: '01', title: translate('newSlide.step.1'), body: translate('newSlide.step.body') },
      { label: '02', title: translate('newSlide.step.2'), body: translate('newSlide.step.body') },
      { label: '03', title: translate('newSlide.step.3'), body: translate('newSlide.step.body') },
    ],
    chart: { unit: '%', points: [{ label: 'A', value: 28 }, { label: 'B', value: 46 }, { label: 'C', value: 72 }] },
    images: [{ src: 'assets/studio.jpg', alt: translate('newSlide.imageAlt') }],
    quote: translate('newSlide.quote'),
    quoteBy: translate('newSlide.quoteBy'),
    footer: 'CreatPPT',
  }
}

function syncAssetManifest() {
  const imagesById = new Map(
    deck.value.slides
      .flatMap(slide => slide.images ?? [])
      .filter(image => image.assetId)
      .map(image => [image.assetId as string, image]),
  )
  if (!imagesById.size || !deck.value.assetManifest?.length) return
  deck.value.assetManifest = deck.value.assetManifest.map(asset => {
    const image = imagesById.get(asset.id)
    if (!image) return asset
    return {
      ...asset,
      src: image.src,
      alt: image.alt,
      caption: image.caption,
      provenance: {
        ...asset.provenance,
        kind: image.provenance?.kind ?? asset.provenance?.kind ?? 'local',
        source: image.provenance?.source ?? image.src,
      },
    }
  })
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function ensureCurrentSlide() {
  if (!deck.value.slides.some(slide => slide.id === currentSlideId.value)) {
    currentSlideId.value = deck.value.slides[0]?.id ?? ''
  }
}

function findCachedDeck(): DeckSpec | undefined {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith('creatppt:')) continue
    try {
      return parseDeck(JSON.parse(localStorage.getItem(key) || 'null'))
    }
    catch {
      // Ignore invalid browser backups.
    }
  }
  return undefined
}
