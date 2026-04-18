import 'server-only'

import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

const MAX_EXTRACTED_TEXT_LENGTH = 80_000

type PdfParseConstructor = (typeof import('pdf-parse'))['PDFParse']

let pdfParseConstructorPromise: Promise<PdfParseConstructor> | null = null

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH)
}

async function loadPdfParseConstructor() {
  if (!pdfParseConstructorPromise) {
    pdfParseConstructorPromise = (async () => {
      // Force the Node/CJS bundle and real worker file to avoid Next server-bundle
      // fake-worker resolution failures when PDFs are parsed from a server action.
      const pdfParseEntryPath = join(
        process.cwd(),
        'node_modules',
        'pdf-parse',
        'dist',
        'pdf-parse',
        'cjs',
        'index.cjs',
      )
      const pdfWorkerEntryPath = join(
        process.cwd(),
        'node_modules',
        'pdf-parse',
        'dist',
        'pdf-parse',
        'cjs',
        'pdf.worker.mjs',
      )

      // Magic comments tell both bundlers to leave this import alone. Without them,
      // Turbopack (and Webpack in prod builds) try to statically analyze the dynamic
      // expression and fail with "Cannot find module as expression is too dynamic"
      // at runtime — the exact error Alvis hit on Generate Profile. At runtime Node's
      // native ESM loader resolves the file:// URL directly. createRequire was the
      // previous attempt; Turbopack analyzes `require(variable)` the same way it
      // analyzes `import(variable)`, so the ignore comments are the only reliable
      // opt-out.
      const pdfParseRuntime = (await import(
        /* webpackIgnore: true */
        /* turbopackIgnore: true */
        pathToFileURL(pdfParseEntryPath).href
      )) as typeof import('pdf-parse')
      const PDFParse = pdfParseRuntime.PDFParse

      if (typeof PDFParse !== 'function') {
        throw new Error('PDF parser could not be loaded.')
      }

      PDFParse.setWorker(pathToFileURL(pdfWorkerEntryPath).href)
      return PDFParse
    })()
  }

  return pdfParseConstructorPromise
}

async function extractPdfText(file: File) {
  const PDFParse = await loadPdfParseConstructor()
  const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) })

  try {
    const result = await parser.getText()
    return normalizeExtractedText(result.text)
  } finally {
    await parser.destroy()
  }
}

async function extractPlainText(file: File) {
  return normalizeExtractedText(Buffer.from(await file.arrayBuffer()).toString('utf8'))
}

async function extractWithTextutil(file: File) {
  const suffix = extname(file.name) || '.txt'
  const tempDirectory = await mkdtemp(join(tmpdir(), 'profile-source-'))
  const filePath = join(tempDirectory, `document${suffix}`)

  try {
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()))

    const { stdout } = await execFile('/usr/bin/textutil', ['-convert', 'txt', '-stdout', filePath], {
      maxBuffer: 12 * 1024 * 1024,
    })

    return normalizeExtractedText(stdout)
  } finally {
    await rm(tempDirectory, { force: true, recursive: true })
  }
}

export async function extractUploadedDocumentText(file: File) {
  const extension = extname(file.name).toLowerCase()

  if (extension === '.md' || extension === '.markdown' || extension === '.txt') {
    return extractPlainText(file)
  }

  if (extension === '.pdf') {
    return extractPdfText(file)
  }

  if (extension === '.doc' || extension === '.docx') {
    return extractWithTextutil(file)
  }

  throw new Error(`${file.name} is not a supported document type. Use MD, PDF, DOC, or DOCX.`)
}
