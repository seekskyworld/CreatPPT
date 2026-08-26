export function getAtPath(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) return current[Number(part)]
    if (typeof current === 'object') return (current as Record<string, unknown>)[part]
    return undefined
  }, input)
}

export function setAtPath(input: object, path: string, value: unknown): void {
  const parts = path.split('.')
  let current: unknown = input
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      if (Array.isArray(current)) current[Number(part)] = value
      else if (current && typeof current === 'object') (current as Record<string, unknown>)[part] = value
      return
    }
    if (Array.isArray(current)) current = current[Number(part)]
    else if (current && typeof current === 'object') current = (current as Record<string, unknown>)[part]
  })
}
