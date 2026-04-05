export type OverlayPlacement = 'above' | 'below'

interface OverlayAnchorRect {
  bottom: number
  top: number
}

export function getOverlayPlacement(
  anchorRect: OverlayAnchorRect,
  panelHeight: number,
  viewportHeight: number,
  offset = 8,
): OverlayPlacement {
  const spaceBelow = viewportHeight - anchorRect.bottom
  const spaceAbove = anchorRect.top

  return panelHeight > spaceBelow - offset && spaceAbove > spaceBelow ? 'above' : 'below'
}
