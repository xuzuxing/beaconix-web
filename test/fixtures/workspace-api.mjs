// Deferred API boundary for organization-store tests only.
export const calls = { organizations: [], projects: [], subscription: [] }
const deferred = (kind, scope) =>
  new Promise((resolve, reject) => {
    calls[kind].push({ scope, resolve, reject })
  })
export const listOrganizations = () => deferred('organizations')
export const listProjects = (orgId) => deferred('projects', orgId)
export const getSubscriptionStack = (orgId) => deferred('subscription', orgId)
export function clearCalls() {
  Object.values(calls).forEach((queue) => {
    queue.length = 0
  })
}
