import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const workspaceNextDir = path.resolve('.next')
const tempNextDir = path.join(os.tmpdir(), 'doomscrollingjobs-next-build')
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

if (process.platform === 'darwin') {
  const nextPackagesDir = path.resolve('node_modules', '@next')

  if (fs.existsSync(nextPackagesDir)) {
    for (const packageName of fs.readdirSync(nextPackagesDir)) {
      if (!packageName.startsWith('swc-')) {
        continue
      }

      const packageDir = path.join(nextPackagesDir, packageName)

      for (const entryName of fs.readdirSync(packageDir)) {
        if (!entryName.endsWith('.node')) {
          continue
        }

        spawnSync('xattr', ['-d', 'com.apple.quarantine', path.join(packageDir, entryName)], {
          stdio: 'ignore',
        })
      }
    }
  }
}

try {
  const currentStat = fs.lstatSync(workspaceNextDir)

  if (currentStat.isSymbolicLink()) {
    const currentTarget = fs.realpathSync(workspaceNextDir)
    const desiredTarget = fs.realpathSync(tempNextDir)

    if (currentTarget === desiredTarget) {
      process.exit(0)
    }
  }

  fs.rmSync(workspaceNextDir, { recursive: true, force: true })
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
    throw error
  }
}

fs.rmSync(tempNextDir, { recursive: true, force: true })
fs.mkdirSync(tempNextDir, { recursive: true })
fs.symlinkSync(tempNextDir, workspaceNextDir, linkType)
