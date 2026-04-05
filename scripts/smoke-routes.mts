const defaultJobId = 'ec47ed58-6782-46e4-8ce7-4b3241ef345c'
const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
const jobId = process.argv[2] || process.env.SMOKE_JOB_ID || defaultJobId

interface RouteCheck {
  expectedStatuses: number[]
  pathname: string
  redirect?: RequestRedirect
}

const routeChecks: RouteCheck[] = [
  {
    expectedStatuses: [200],
    pathname: '/operators',
  },
  {
    expectedStatuses: [200],
    pathname: '/dashboard',
  },
  {
    expectedStatuses: [200],
    pathname: '/profile',
  },
  {
    expectedStatuses: [200],
    pathname: `/jobs/${jobId}`,
  },
  {
    expectedStatuses: [200, 307],
    pathname: `/jobs/${jobId}/packet`,
    redirect: 'manual',
  },
]

const results = await Promise.all(
  routeChecks.map(async (check) => {
    const response = await fetch(`${baseUrl}${check.pathname}`, {
      redirect: check.redirect ?? 'follow',
    })

    return {
      location: response.headers.get('location'),
      ok: check.expectedStatuses.includes(response.status),
      pathname: check.pathname,
      status: response.status,
    }
  }),
)

const passed = results.every((result) => result.ok)

console.log(
  JSON.stringify(
    {
      baseUrl,
      jobId,
      passed,
      results,
    },
    null,
    2,
  ),
)

if (!passed) {
  process.exit(1)
}
