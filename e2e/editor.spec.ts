import { expect, test } from '@playwright/test'

test('detects and switches the workspace language', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  const language = page.locator('.language-select')
  await expect(language).toHaveValue('zh')
  await language.selectOption('en')
  await expect(language).toHaveValue('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Export PPT' })).toBeVisible()
  await expect(page.getByText('Template', { exact: true })).toBeVisible()
  await language.selectOption('zh')
  await expect(page.getByRole('button', { name: '导出 PPT' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
})

test('opens a finished deck, edits it, switches template, and exports on click', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await expect(page.getByLabel('CreatPPT')).toBeVisible()
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/creatppt-icon.png')
  await expect.poll(async () => page.locator('.brand-mark').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('.stage .slide-surface')).toHaveAttribute('data-layout', 'cover')

  const title = page.locator('.stage .slide-title')
  await title.click()
  await title.fill('一份已经完成的 Web 演示稿')
  await title.blur()
  await expect(title).toContainText('一份已经完成的 Web 演示稿')

  await page.getByRole('radio', { name: /Editorial/ }).click()
  await expect(page.locator('.stage .slide-surface')).toHaveAttribute('data-template', 'editorial')

  await page.getByRole('button', { name: '打开第 2 页' }).click()
  await expect(page.locator('.stage .scene-element[data-element-id*="agenda-index-0"]')).toHaveText('01')
  const candidateSelect = page.locator('#candidate-select')
  await expect(candidateSelect).toBeVisible()
  const candidateOptions = await candidateSelect.locator('option').count()
  expect(candidateOptions).toBeGreaterThanOrEqual(2)
  await candidateSelect.selectOption({ index: 1 })
  await page.locator('#density-select').selectOption('dense')
  await page.locator('#font-scale').fill('1.1')
  await expect.poll(async () => (await page.request.get('/api/deck')).status()).toBe(200)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 PPT' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.pptx$/)
  await expect(page.getByText('PPTX 已通过结构检查并开始下载。')).toBeVisible()
})

test('keeps locked elements selectable so they can be unlocked', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: '添加矩形' }).click()
  const element = page.locator('.stage .scene-element.is-selected').last()
  await expect(element).toHaveClass(/is-selected/)

  await page.getByRole('button', { name: '锁定元素' }).click()
  await expect(element).toHaveClass(/is-locked/)
  await expect(page.getByRole('button', { name: '解锁元素' })).toBeVisible()

  // Clicking a locked object must keep it addressable from the inspector.
  await element.click({ position: { x: 12, y: 12 } })
  await page.getByRole('button', { name: '解锁元素' }).click()
  await expect(element).not.toHaveClass(/is-locked/)
  await expect(page.getByRole('button', { name: '锁定元素' })).toBeVisible()
})

test('keeps the mobile workspace usable without overlapping panels', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto('/')
  await expect(page.locator('.stage')).toBeVisible()
  await page.getByRole('button', { name: '页面列表' }).click()
  await expect(page.locator('.slide-rail')).toBeVisible()
  await expect(page.locator('.stage')).toBeHidden()
  await page.getByRole('button', { name: '属性' }).click()
  await expect(page.locator('.inspector')).toBeVisible()
  await expect(page.locator('.slide-rail')).toBeHidden()
})

test('edits a freeform scene element and persists its geometry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await expect(page.locator('.stage .slide-surface')).toHaveAttribute('data-layout', 'cover')

  await page.getByRole('button', { name: '添加文本' }).click()
  const element = page.locator('.stage .scene-element.is-selected').last()
  await expect(element).toBeVisible()
  const content = element.locator('.scene-text-content')
  await expect(content).toBeVisible()
  await content.fill('拖拽后的标题')
  await content.blur()

  const before = await element.boundingBox()
  if (!before) throw new Error('scene element did not expose a bounding box')
  const elementId = await element.getAttribute('data-element-id')
  if (!elementId) throw new Error('scene element id missing')
  await expect.poll(async () => {
    const response = await page.request.get('/api/deck')
    const deck = await response.json()
    return Boolean(deck.slides[0].elements.find((candidate: { id: string }) => candidate.id === elementId))
  }).toBe(true)
  const beforeDeck = await (await page.request.get('/api/deck')).json()
  const beforeGeometry = beforeDeck.slides[0].elements.find((candidate: { id: string }) => candidate.id === elementId)
  if (!beforeGeometry) throw new Error('scene element was not persisted before drag')
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height / 2 + 64, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => {
    const response = await page.request.get('/api/deck')
    const deck = await response.json()
    const slide = deck.slides[0]
    const moved = slide.elements.find((candidate: { id: string; text?: string }) => candidate.id === elementId)
    return moved && {
      changed: moved.x !== beforeGeometry.x || moved.y !== beforeGeometry.y,
      userEdited: moved.userEdited === true,
    }
  }).toEqual({ changed: true, userEdited: true })

  await page.getByRole('button', { name: '删除元素' }).click()
  await expect(element).toHaveCount(0)
})

test('supports marquee selection, rotation, and constrained resize', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: '添加矩形' }).click()
  const initialElement = page.locator('.stage .scene-element.is-selected').last()
  const elementId = await initialElement.getAttribute('data-element-id')
  if (!elementId) throw new Error('scene element id missing')
  const element = page.locator(`.stage .scene-element[data-element-id="${elementId}"]`)
  const surface = await page.locator('.stage .slide-surface').boundingBox()
  if (!surface) throw new Error('slide surface did not expose a bounding box')
  const scale = surface.width / 1600

  // Start on blank canvas and drag a marquee around the newly-created rectangle.
  await page.mouse.move(surface.x + 10, surface.y + 10)
  await page.mouse.down()
  await page.mouse.move(surface.x + 980 * scale, surface.y + 520 * scale, { steps: 8 })
  await page.mouse.up()
  await expect(element).toHaveClass(/is-selected/)
  await element.click({ position: { x: 12, y: 12 } })
  await expect(element).toHaveClass(/is-selected/)

  const rotationHandle = element.locator('.rotation-handle')
  const rotationBox = await rotationHandle.boundingBox()
  if (!rotationBox) throw new Error('rotation handle did not render for selected element')
  await page.mouse.move(rotationBox.x + rotationBox.width / 2, rotationBox.y + rotationBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rotationBox.x + 84, rotationBox.y + 12, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    const item = deck.slides[0].elements.find((candidate: { id: string }) => candidate.id === elementId)
    return Math.abs(item?.rotation ?? 0) > 1
  }).toBe(true)

  const resizeHandle = element.locator('.handle-se')
  const resizeBox = await resizeHandle.boundingBox()
  if (!resizeBox) throw new Error('resize handle did not render for selected element')
  let before: { width: number; height: number } | undefined
  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    before = deck.slides[0].elements.find((candidate: { id: string }) => candidate.id === elementId)
    return Boolean(before)
  }).toBe(true)
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
  await page.mouse.down()
  await page.keyboard.down('Shift')
  await page.mouse.move(resizeBox.x + 90, resizeBox.y + 30, { steps: 8 })
  await page.keyboard.up('Shift')
  await page.mouse.up()
  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    const item = deck.slides[0].elements.find((candidate: { id: string }) => candidate.id === elementId)
    return Boolean(item && before && item.width !== before.width && item.height !== before.height)
  }).toBe(true)
})

test('accepts plain text dropped onto the canvas as a new element', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  const layer = page.locator('.stage .element-layer')
  await layer.evaluate((node) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', '从画布拖入的说明')
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: 820, clientY: 480, dataTransfer }))
  })
  await expect(page.locator('.stage .scene-text-content', { hasText: '从画布拖入的说明' })).toBeVisible()
  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    return deck.slides[0].elements.some((element: { text?: string }) => element.text === '从画布拖入的说明')
  }).toBe(true)
})

test('duplicates an element when dragged with the platform modifier', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本' }).click()
  const element = page.locator('.stage .scene-element.is-selected').last()
  const box = await element.boundingBox()
  if (!box) throw new Error('scene element did not expose a bounding box')
  const originalId = await element.getAttribute('data-element-id')
  if (!originalId) throw new Error('scene element id missing')
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 96, box.y + box.height / 2 + 48, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    return deck.slides[0].elements.some((element: { id: string }) => element.id.startsWith(`${originalId}-drag-`))
  }).toBe(true)
})

test('duplicates the complete multi-selection when dragging with the platform modifier', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本' }).click()
  const first = page.locator('.stage .scene-element.is-selected').last()
  const firstId = await first.getAttribute('data-element-id')
  if (!firstId) throw new Error('first scene element id missing')
  const firstById = page.locator(`.stage .scene-element[data-element-id="${firstId}"]`)
  await page.getByRole('button', { name: '添加文本' }).click()
  const second = page.locator('.stage .scene-element.is-selected').last()
  const secondId = await second.getAttribute('data-element-id')
  if (!secondId) throw new Error('second scene element id missing')
  const secondById = page.locator(`.stage .scene-element[data-element-id="${secondId}"]`)
  const secondBox = await secondById.boundingBox()
  if (!secondBox) throw new Error('second scene element did not expose a bounding box')
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(secondBox.x + secondBox.width / 2 + 500, secondBox.y + secondBox.height / 2 + 24, { steps: 6 })
  await page.mouse.up()

  await page.keyboard.down('Control')
  await firstById.click()
  await page.keyboard.up('Control')
  await expect(page.locator('.stage .scene-element.is-selected')).toHaveCount(2)

  const box = await firstById.boundingBox()
  if (!box) throw new Error('first scene element did not expose a bounding box')
  await page.keyboard.down('Control')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 84, box.y + box.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')

  await expect.poll(async () => {
    const deck = await (await page.request.get('/api/deck')).json()
    const ids = deck.slides[0].elements.map((element: { id: string }) => element.id)
    return {
      firstClone: ids.some((id: string) => id.startsWith(`${firstId}-drag-`)),
      secondClone: ids.some((id: string) => id.startsWith(`${secondId}-drag-`)),
    }
  }).toEqual({ firstClone: true, secondClone: true })
})
