function splitExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return {
      baseName: fileName,
      extension: '',
    }
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}

export function formatCompactFileName(fileName: string, maxLength = 30) {
  const trimmed = fileName.trim()

  if (!trimmed || trimmed.length <= maxLength) {
    return trimmed
  }

  const { baseName, extension } = splitExtension(trimmed)
  const ellipsis = '...'
  const availableLength = Math.max(6, maxLength - extension.length - ellipsis.length)
  const startLength = Math.max(4, Math.ceil(availableLength * 0.55))
  const endLength = Math.max(3, availableLength - startLength)

  if (baseName.length <= availableLength) {
    return `${baseName}${extension}`
  }

  return `${baseName.slice(0, startLength)}${ellipsis}${baseName.slice(-endLength)}${extension}`
}
