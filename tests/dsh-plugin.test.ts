import { describe, expect, it } from 'vitest'
import { apply } from '../src/dsh-plugin'

describe('DeepSeek Harness bundle', () => {
  it('registers the single presentation creation tool', () => {
    let registered: { name?: string; parameters?: Record<string, unknown> } | undefined
    apply({ tools: { register: (tool: typeof registered) => { registered = tool; return () => {} } } } as never)

    expect(registered?.name).toBe('create_presentation')
    expect(registered?.parameters).toHaveProperty('properties.brief')
    expect(registered?.parameters).toHaveProperty('properties.template')
  })
})
