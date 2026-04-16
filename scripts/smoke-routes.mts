import { fetchSmoke, getSmokeBaseUrl, getSmokeJobId } from './smoke-helpers.mts'

const baseUrl = getSmokeBaseUrl()
const jobId = getSmokeJobId(process.argv[2])

interface RouteCheck {
  expectedStatuses: number[]
  pathname: string
  redirect?: RequestRedirect
}

const routeChecks: RouteCheck[] = [
  {
    expectedStatuses: [200],
    pathname: '/',
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
    expectedStatuses: [307, 308],
    pathname: `/jobs/${jobId}/packet`,
    redirect: 'manual',
  },
  {
    expectedStatuses: [200],
    pathname: '/system-inventory',
  },
]

const results = await Promise.all(
  routeChecks.map(async (check) => {
    const response = await fetchSmoke(check.pathname, {
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
