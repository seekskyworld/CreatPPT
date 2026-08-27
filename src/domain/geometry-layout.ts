/** Small geometry vocabulary for layout adapters. Values remain canvas pixels. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export function box(x: number, y: number, width: number, height: number): Box {
  return { x, y, width, height }
}

export function inset(value: Box, insets: Partial<Insets> = {}): Box {
  const top = insets.top ?? 0
  const right = insets.right ?? 0
  const bottom = insets.bottom ?? 0
  const left = insets.left ?? 0
  return {
    x: value.x + left,
    y: value.y + top,
    width: Math.max(0, value.width - left - right),
    height: Math.max(0, value.height - top - bottom),
  }
}

export function alignCenter(parent: Box, width: number, height: number): Box {
  return box(parent.x + (parent.width - width) / 2, parent.y + (parent.height - height) / 2, width, height)
}
