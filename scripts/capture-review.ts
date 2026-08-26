import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.REVIEW_URL || 'http://127.0.0.1:4173'
const outputDir = '.tmp/review'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
const errors: string[] = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto(baseURL)
await page.locator('.stage .slide-surface').waitFor()

const templates = ['Signal', 'Editorial', 'Studio']
const slideNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

for (const template of templates) {
  await page.getByRole('radio', { name: new RegExp(template) }).click()
  for (const slideNumber of slideNumbers) {
    await page.getByRole('button', { name: `打开第 ${slideNumber} 页` }).click()
    await page.getByRole('button', { name: '演示' }).click()
    await page.locator('.presentation-frame').screenshot({ path: `${outputDir}/${template.toLowerCase()}-${String(slideNumber).padStart(2, '0')}.png` })
    await page.getByRole('button', { name: '退出演示' }).click()
  }
}

await page.screenshot({ path: `${outputDir}/workspace-desktop.png`, fullPage: true })
await browser.close()

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
process.stdout.write(`Captured ${templates.length * slideNumbers.length + 1} review screenshots in ${outputDir}.\n`)
