import { expect, type Page, type Route } from '@playwright/test'
import { ownerPermissions, orgPermissions, project, projectPermission } from '../fixtures/access'

const now = '2026-10-13T00:00:00Z'
export async function mockWorkspace(
  page: Page,
  options: {
    owner?: boolean
    admin?: boolean
    empty?: boolean
    anonymous?: boolean
    projectId?: string
    dark?: boolean
    locale?: string
    invitations?: boolean
    profileFailure?: boolean
    sharedBinding?: boolean
    persistedSuperAdmin?: boolean
  } = {},
) {
  const user = {
    id: 'u1',
    name: 'Fixture User',
    email: 'fixture@example.invalid',
    globalRole: 'USER',
    avatarUrl: null,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  }
  const state = {
    roles: { a: 'VIEWER', b: 'ADMIN' } as Record<string, 'VIEWER' | 'MEMBER' | 'ADMIN'>,
    organizationRole: options.owner ? 'OWNER' : options.admin ? 'ADMIN' : 'MEMBER',
    archived: [] as string[],
    projectIds: options.empty
      ? []
      : options.owner || options.admin
        ? ['a', 'b', 'c', 'd']
        : ['a', 'b'],
    membershipId: 'member-old',
    version: 7,
    grants: [{ projectId: 'a', role: 'VIEWER' }] as {
      projectId: string
      role: string
    }[],
    projectNames: {} as Record<string, string>,
    monitorDrafts: {} as Record<string, Record<string, unknown>>,
    detailUnavailable: false,
    conflict: false,
    rejoin: false,
    permissionFailure: false,
    accepted: false,
    requests: [] as {
      method: string
      path: string
      body: unknown
      headers: Record<string, string>
    }[],
    unexpected: [] as string[],
    pageErrors: [] as string[],
    consoleErrors: [] as string[],
  }
  page.on('pageerror', (error) => state.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'warning') state.consoleErrors.push(message.text())
    if (message.type() === 'error' && !message.text().includes('Failed to load resource'))
      state.consoleErrors.push(message.text())
  })
  await page.addInitScript(
    ({ user, options }) => {
      if (!options.anonymous) {
        localStorage.setItem(
          'beacon-vue3:user',
          JSON.stringify({
            accessToken: 'fixture-access',
            refreshToken: 'fixture-refresh',
            user,
          }),
        )
        localStorage.setItem(
          'beacon-vue3:organization',
          JSON.stringify({
            currentOrganizationId: 'o1',
            currentProjectId: options.projectId ?? 'a',
          }),
        )
      }
      localStorage.setItem(
        'beacon-vue3:app',
        JSON.stringify({
          locale: options.locale ?? 'zh-CN',
          theme: options.dark ? 'dark' : 'light',
          collapsed: false,
        }),
      )
    },
    { user, options },
  )
  const organization = (id: string) => ({
    id,
    name: id === 'o1' ? 'Fixture Team' : 'Second Team',
    slug: id,
    ownerId: options.owner ? 'u1' : 'owner',
    description: null,
    website: null,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  })
  const isOrgAdmin = () => ['OWNER', 'ADMIN'].includes(state.organizationRole)
  const permissions = (id: string) =>
    isOrgAdmin()
      ? {
          ...ownerPermissions,
          organizationId: id,
          organizationRole: state.organizationRole,
          capabilities: {
            ...ownerPermissions.capabilities,
            grantOrganizationAdmin: state.organizationRole === 'OWNER',
          },
        }
      : { ...orgPermissions, organizationId: id }
  const invitation = () => ({
    id: 'inv1',
    email: user.email,
    organizationId: 'o1',
    role: 'MEMBER',
    status: state.accepted ? 'ACCEPTED' : 'PENDING',
    accessMode: 'SELECTED_PROJECTS',
    projects: [
      { projectId: 'a', projectName: 'Project A', role: 'VIEWER' },
      { projectId: 'b', projectName: 'Project B', role: 'ADMIN' },
    ],
    expiresAt: '2099-01-01T00:00:00Z',
    sentById: 'owner',
    acceptedAt: null,
    createdAt: now,
    updatedAt: now,
    organization: organization('o1'),
    sentBy: {
      id: 'owner',
      name: 'Fixture Owner',
      email: 'owner@example.invalid',
    },
  })
  const monitor = (id: string) => ({
    id: `monitor-${id}`,
    organizationId: 'o1',
    projectId: id,
    name: `Monitor ${id.toUpperCase()}`,
    type: 'HTTP',
    target:
      state.roles[id] === 'ADMIN' || isOrgAdmin()
        ? 'https://private-target.example.invalid'
        : '[redacted]',
    interval: 60,
    timeout: 5000,
    expectedStatus: 200,
    failureThreshold: 3,
    enabled: true,
    executionEligible: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    checkSsl: false,
    sslExpiryThreshold: 30,
    sslExpiresAt: null,
    sslIssuer: null,
    sslValid: null,
    status: 'UP',
    failCount: 0,
    lastCheckAt: now,
    lastLatency: 42,
    lastError: null,
    availabilityEnabled: true,
    availabilityThreshold: 90,
    availabilityWindow: 10,
    availabilityStatus: 'UP',
    availableFailCount: 0,
    ...(state.roles[id] === 'ADMIN' || isOrgAdmin()
      ? {
          config: { headers: { 'X-Private': 'hidden-config' } },
          notificationChannelIds: [],
        }
      : {}),
    ...state.monitorDrafts[id],
  })
  async function reply(route: Route, data: unknown, status = 200) {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status < 400 ? { data, meta: { timestamp: now } } : data),
    })
  }
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1') {
      state.unexpected.push(`External request: ${url.origin}${url.pathname}`)
      await route.abort()
      return
    }
    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }
    const path = url.pathname.slice(4)
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : undefined
    state.requests.push({ method, path, body, headers: request.headers() })
    if (path === '/settings/public') return reply(route, {})
    if (path === '/auth/me')
      return reply(
        route,
        options.profileFailure ? { message: 'Fixture profile offline' } : user,
        options.profileFailure ? 503 : 200,
      )
    if (path === '/auth/logout') return reply(route, null)
    if (path === '/notifications/stream')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: ': fixture heartbeat\n\n',
      })
    if (path === '/notifications/unread-count') return reply(route, { count: 0 })
    if (path === '/notifications')
      return reply(route, {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      })
    if (path === '/invitations/pending')
      return reply(route, options.invitations && !state.accepted ? [invitation()] : [])
    if (path === '/invitations/by-id/inv1') return reply(route, invitation())
    if (path === '/invitations/by-id/inv1/accept') {
      state.accepted = true
      state.projectIds = ['a', 'b']
      return reply(route, invitation())
    }
    if (path === '/invitations/fixture-token')
      return reply(route, {
        organizationName: 'Fixture Team',
        organizationSlug: 'fixture-team',
        organizationLogoUrl: null,
        inviterName: 'Fixture Owner',
        role: 'MEMBER',
        accessMode: 'SELECTED_PROJECTS',
        projectCount: 2,
        expiresAt: '2027-01-01T00:00:00Z',
        status: 'PENDING',
        requiresLogin: true,
      })
    if (path === '/organizations') return reply(route, [organization('o1'), organization('o2')])
    if (/^\/organizations\/o[12]\/my-permissions$/.test(path))
      return reply(
        route,
        state.permissionFailure ? { message: 'Fixture offline' } : permissions(path.split('/')[2]!),
        state.permissionFailure ? 503 : 200,
      )
    if (/^\/organizations\/o[12]\/projects$/.test(path)) {
      if (method === 'POST') {
        const payload = body as {
          name: string
          key: string
          description?: string
        }
        const id = `new-${state.projectIds.length + 1}`
        state.projectIds.push(id)
        state.projectNames[id] = payload.name
        return reply(
          route,
          {
            ...project(id),
            name: payload.name,
            key: payload.key,
            description: payload.description ?? null,
            organizationId: path.split('/')[2],
          },
          201,
        )
      }
      return reply(
        route,
        state.projectIds.map((id) => ({
          ...project(id, state.archived.includes(id) ? 'ARCHIVED' : 'ACTIVE'),
          name: state.projectNames[id] ?? project(id).name,
          organizationId: path.split('/')[2],
        })),
      )
    }
    if (/^\/organizations\/o[12]\/subscription$/.test(path))
      return reply(route, { effectivePlan: null, stack: [] })
    if (/^\/projects\/[^/]+\/my-permissions$/.test(path)) {
      const id = path.split('/')[2]!
      const permitted = state.projectIds.includes(id)
      const projection = projectPermission(
        id,
        isOrgAdmin() ? 'ADMIN' : (state.roles[id] ?? 'VIEWER'),
      )
      return reply(
        route,
        permitted
          ? {
              ...projection,
              ...permissions('o1'),
              projectId: id,
              assignedRole: isOrgAdmin() ? null : projection.assignedRole,
              effectiveRole: projection.effectiveRole,
              capabilities: Object.fromEntries(
                Object.entries(projection.capabilities).map(([key, allowed]) => [
                  key,
                  key === 'monitor.read' ? allowed : allowed && !state.archived.includes(id),
                ]),
              ),
            }
          : { message: 'Resource unavailable' },
        permitted ? 200 : 404,
      )
    }
    if (/^\/projects\/[^/]+\/monitors$/.test(path)) {
      const id = path.split('/')[2]!
      if (method === 'POST') state.monitorDrafts[id] = body as Record<string, unknown>
      return reply(route, method === 'POST' ? monitor(id) : [monitor(id)])
    }
    if (
      /^\/projects\/[^/]+\/monitors\/[^/]+\/rule-bindings\/[^/]+$/.test(path) &&
      method === 'DELETE'
    )
      return reply(route, null)
    if (/^\/projects\/[^/]+\/monitors\/[^/]+\/rule-bindings$/.test(path))
      return reply(
        route,
        options.sharedBinding
          ? [
              {
                id: 'binding-1',
                monitorId: 'monitor-b',
                ruleGroupId: 'template-1',
                priority: 0,
                enabled: true,
                createdAt: now,
                updatedAt: now,
                ruleGroup: {
                  id: 'template-1',
                  name: 'Shared template summary',
                  description: null,
                  enabled: true,
                },
              },
            ]
          : [],
      )
    if (/^\/projects\/[^/]+\/monitors\/[^/]+\/insights$/.test(path)) {
      const id = path.split('/')[2]!
      return reply(route, {
        monitorId: `monitor-${id}`,
        range: '24h',
        tz: 'UTC',
        asOf: now,
        from: now,
        to: now,
        metricBasis: {
          sampleSource: 'LOCAL',
          availability: 'EFFECTIVE_SUCCESS',
          latency: 'LOCAL_DURATION',
        },
        history: {
          retentionDays: 30,
          availableFrom: now,
          status: 'EMPTY',
          alertsAvailableFrom: now,
          alertsStatus: 'EMPTY',
        },
        latest: {
          status: 'UP',
          failCount: 0,
          lastCheckAt: now,
          lastLatency: 42,
          lastError: null,
          ongoingCount: 0,
        },
        metrics: {
          totalChecks: 0,
          failedChecks: 0,
          rescuedChecks: 0,
          uptimePercent: null,
          avgLatencyMs: null,
          p50LatencyMs: null,
          p95LatencyMs: null,
          p99LatencyMs: null,
        },
        timeline: { interval: '1h', points: [] },
        checks: [],
        checksLimit: 50,
        eventsLimit: 50,
        events: [],
      })
    }
    if (/^\/projects\/[^/]+\/monitors\/[^/]+$/.test(path)) {
      const id = path.split('/')[2]!
      if (method === 'PATCH')
        state.monitorDrafts[id] = {
          ...state.monitorDrafts[id],
          ...(body as Record<string, unknown>),
        }
      return reply(
        route,
        state.detailUnavailable ? { message: 'Resource unavailable' } : monitor(id),
        state.detailUnavailable ? 404 : 200,
      )
    }
    if (/^\/projects\/[^/]+\/monitors\/[^/]+\/(?:check|pause|resume|test-alert)$/.test(path))
      return reply(route, monitor(path.split('/')[2]!))
    if (path === '/organizations/o1/rule-groups') return reply(route, [])
    if (path === '/organizations/o1/notification-channels') return reply(route, [])
    if (path === '/rule-meta')
      return reply(route, {
        fields: ['success', 'latency', 'certDaysRemaining', 'statusCode', 'bodyContains'],
        meta: {
          success: {
            valueType: 'boolean',
            operators: ['eq', 'neq'],
            default: { operator: 'eq', value: false },
          },
          latency: {
            valueType: 'number',
            operators: ['gt', 'gte', 'lt', 'lte'],
            default: { operator: 'gt', value: 1000 },
          },
          certDaysRemaining: {
            valueType: 'number',
            operators: ['lt'],
            default: { operator: 'lt', value: 30 },
          },
          statusCode: {
            valueType: 'number',
            operators: ['eq', 'statusClass'],
            default: { operator: 'eq', value: 200 },
          },
          bodyContains: {
            valueType: 'string',
            operators: ['contains'],
            default: { operator: 'contains', value: '' },
          },
        },
        statusClassValues: [1, 2, 3, 4, 5],
      })
    if (path === '/organizations/o1/members')
      return reply(route, [
        {
          id: 'm1',
          userId: 'u1',
          organizationId: 'o1',
          role: options.owner ? 'OWNER' : 'ADMIN',
          joinedAt: now,
          updatedAt: now,
          invitedById: null,
          user: {
            ...user,
            globalRole: options.persistedSuperAdmin ? 'SUPER_ADMIN' : user.globalRole,
          },
        },
        {
          id: state.membershipId,
          userId: 'u2',
          organizationId: 'o1',
          role: 'MEMBER',
          joinedAt: now,
          updatedAt: now,
          invitedById: null,
          user: {
            id: 'u2',
            name: 'Member Two',
            email: 'member2@example.invalid',
            avatarUrl: null,
          },
        },
      ])
    if (path === '/organizations/o1/invitations')
      return reply(route, method === 'POST' ? invitation() : [])
    if (path === '/organizations/o1/members/u2/project-permissions') {
      if (method === 'PUT') {
        if (state.conflict) {
          state.conflict = false
          state.version++
          if (state.rejoin) state.membershipId = 'member-rejoined'
          return reply(route, { message: 'Conflict' }, 409)
        }
        const params = body as {
          expectedMembershipId: string
          expectedVersion: number
          projects: typeof state.grants
        }
        expect(params.expectedMembershipId).toBe(state.membershipId)
        expect(params.expectedVersion).toBe(state.version)
        state.grants = params.projects
        state.version++
      }
      return reply(route, {
        userId: 'u2',
        organizationId: 'o1',
        membershipId: state.membershipId,
        projectPermissionsVersion: state.version,
        organizationRole: 'MEMBER',
        accessMode: 'SELECTED_PROJECTS',
        projects: state.grants.map((grant) => ({
          projectId: grant.projectId,
          projectName: state.projectNames[grant.projectId] ?? project(grant.projectId).name,
          assignedRole: grant.role,
          effectiveRole: grant.role,
        })),
      })
    }
    state.unexpected.push(`${method} ${path}`)
    return reply(route, { message: 'Unmatched fixture endpoint' }, 501)
  })
  return state
}
