import { afterEach, describe, expect, it } from 'vitest'
import { localizeQualityIssue, setLocale, templateLabel, translate } from '@/i18n'

describe('workspace internationalization', () => {
  afterEach(() => setLocale('en'))

  it('switches messages and document language together', () => {
    setLocale('en')
    expect(translate('header.export')).toBe('Export PPT')
    expect(document.documentElement.lang).toBe('en')

    setLocale('zh')
    expect(translate('header.export')).toBe('导出 PPT')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('localizes template and quality labels without changing the issue contract', () => {
    setLocale('en')
    expect(templateLabel('editorial')).toBe('Editorial')
    expect(localizeQualityIssue({
      code: 'TEXT_DENSE',
      severity: 'warning',
      message: 'title 内容偏长（90/72）。',
    })).toContain('title is longer')

    setLocale('zh')
    expect(templateLabel('editorial')).toBe('Editorial / 编辑部')
    expect(localizeQualityIssue({
      code: 'IMAGE_MISSING',
      severity: 'error',
      message: 'cover 页面缺少图片。',
    })).toBe('封面 页面缺少图片。')
  })
})
