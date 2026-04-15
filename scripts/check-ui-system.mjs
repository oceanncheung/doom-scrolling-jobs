import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const stylesRoot = path.join(repoRoot, 'app', 'styles')
const sharedControlsFile = path.join(stylesRoot, 'controls.css')

const sharedButtonSelectors = new Set([
  '.button',
  '.button:hover',
  '.button:disabled',
  '.button::-moz-focus-inner',
  '.button-primary',
  '.button-ghost',
  '.button-small',
  '.button__label',
  '.action-note',
  '.action-note-error',
  '.action-note-success',
])

const rawHairlinePatterns = [
  'left: calc(-1 * var(--queue-column-pad));',
  'width: calc(100% + var(--queue-column-pad));',
  'width: calc(100% + (2 * var(--queue-column-pad)));',
]

async function collectCssFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name)
      if (entry.isDirectory()) {
        return collectCssFiles(entryPath)
      }

      return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : []
    }),
  )

  return files.flat()
}

function stripComments(contents) {
  return contents.replace(/\/\*[\s\S]*?\*\//g, '')
}

function parseBlocks(contents) {
  const blocks = []
  let cursor = 0

  while (cursor < contents.length) {
    const openIndex = contents.indexOf('{', cursor)
    if (openIndex === -1) {
      break
    }

    const selector = contents.slice(cursor, openIndex).trim()
    let depth = 1
    let closeIndex = openIndex + 1

    while (closeIndex < contents.length && depth > 0) {
      const char = contents[closeIndex]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      closeIndex += 1
    }

    if (depth === 0 && selector) {
      const body = contents.slice(openIndex + 1, closeIndex - 1)

      if (selector.startsWith('@')) {
        blocks.push(...parseBlocks(body))
      } else {
        blocks.push({
          body,
          selector,
        })
      }
    }

    cursor = closeIndex
  }

  return blocks
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath)
}

async function main() {
  const cssFiles = await collectCssFiles(stylesRoot)
  const violations = []

  for (const filePath of cssFiles) {
    const contents = stripComments(await fs.readFile(filePath, 'utf8'))
    const blocks = parseBlocks(contents)

    for (const block of blocks) {
      const selectors = block.selector
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean)

      if (filePath !== sharedControlsFile) {
        const sharedSelectorMatch = selectors.find((selector) => sharedButtonSelectors.has(selector))
        if (sharedSelectorMatch) {
          violations.push(
            `${toRelative(filePath)}: shared button selector "${sharedSelectorMatch}" must live in app/styles/controls.css`,
          )
        }
      }

      if (filePath !== sharedControlsFile) {
        const isHairlinePseudoBlock = selectors.some(
          (selector) => selector.includes('::before') || selector.includes('::after'),
        )

        if (isHairlinePseudoBlock) {
          const rawPattern = rawHairlinePatterns.find((pattern) => block.body.includes(pattern))
          if (rawPattern) {
            violations.push(
              `${toRelative(filePath)}: raw edge hairline math "${rawPattern}" should use shared edge variables from app/styles/controls.css`,
            )
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('UI system audit failed:\n')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('UI system audit passed.')
}

await main()
