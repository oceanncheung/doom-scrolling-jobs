export interface UiArtifactViewport {
  height: number
  width: number
}

export type UiArtifactSetupKey =
  | 'open-additional-filters'
  | 'open-experience-tab'

export interface UiArtifactSpec {
  clipSelector?: string
  label: string
  outputPath: string
  requiresSignIn: boolean
  route: string
  setup?: UiArtifactSetupKey
  viewport: UiArtifactViewport
}

const desktopViewport: UiArtifactViewport = {
  height: 1200,
  width: 1920,
}

export function buildUiArtifactManifest(jobId: string): UiArtifactSpec[] {
  return [
    {
      label: 'Home entry',
      outputPath: 'routes/home.png',
      requiresSignIn: false,
      route: '/',
      viewport: desktopViewport,
    },
    {
      label: 'Dashboard',
      outputPath: 'routes/dashboard.png',
      requiresSignIn: true,
      route: '/dashboard',
      viewport: desktopViewport,
    },
    {
      label: 'Profile',
      outputPath: 'routes/profile.png',
      requiresSignIn: true,
      route: '/profile',
      viewport: desktopViewport,
    },
    {
      label: 'Job review',
      outputPath: 'routes/job-review.png',
      requiresSignIn: true,
      route: `/jobs/${jobId}`,
      viewport: desktopViewport,
    },
    {
      label: 'Packet review redirect',
      outputPath: 'routes/packet-review.png',
      requiresSignIn: true,
      route: `/jobs/${jobId}/packet`,
      viewport: desktopViewport,
    },
    {
      label: 'System inventory',
      outputPath: 'routes/system-inventory.png',
      requiresSignIn: true,
      route: '/system-inventory',
      viewport: desktopViewport,
    },
    {
      clipSelector: '.settings-source-uploads-row--materials',
      label: 'Profile source upload row',
      outputPath: 'contracts/profile-source-upload-row.png',
      requiresSignIn: true,
      route: '/profile',
      viewport: desktopViewport,
    },
    {
      clipSelector: '.settings-action-disclosure',
      label: 'Additional filters open',
      outputPath: 'contracts/profile-additional-filters-open.png',
      requiresSignIn: true,
      route: '/profile',
      setup: 'open-additional-filters',
      viewport: desktopViewport,
    },
    {
      clipSelector: '.disclosure-experience .settings-tab-shell',
      label: 'Experience tabs closed',
      outputPath: 'contracts/profile-experience-tabs-closed.png',
      requiresSignIn: true,
      route: '/profile',
      viewport: desktopViewport,
    },
    {
      clipSelector: '.disclosure-experience .settings-tab-shell',
      label: 'Experience tabs open',
      outputPath: 'contracts/profile-experience-tabs-open.png',
      requiresSignIn: true,
      route: '/profile',
      setup: 'open-experience-tab',
      viewport: desktopViewport,
    },
    {
      clipSelector: '.system-inventory-panel .settings-tab-shell.has-selection',
      label: 'System inventory active tab shell',
      outputPath: 'contracts/system-inventory-active-tab-shell.png',
      requiresSignIn: true,
      route: '/system-inventory',
      viewport: desktopViewport,
    },
  ]
}
