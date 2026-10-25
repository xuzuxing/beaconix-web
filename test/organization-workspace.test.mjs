import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { calls, clearCalls } from './fixtures/workspace-api.mjs'

// Load the actual store with only its HTTP boundary replaced.
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/api')
      return {
        url: new URL('./fixtures/workspace-api.mjs', import.meta.url).href,
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const { useOrganizationStore } = await import('../src/stores/modules/organization.ts')
hook.deregister()
const orgs = [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }]
const projects = (id) => [{ id: `p${id}`, organizationId: `o${id}` }]
beforeEach(() => {
  clearCalls()
  setActivePinia(createPinia())
})
function initial() {
  const store = useOrganizationStore()
  store.currentOrganizationId = 'o1'
  store.currentProjectId = 'p1'
  store.organizations = orgs
  store.projects = projects(1)
  return store
}
test('deep-link commit invalidates a delayed header project response', async () => {
  const store = initial()
  const loading = store.loadProjects()
  assert.equal(store.applyWorkspace('o2', 'p2', orgs, projects(2), store.workspaceRevision), true)
  calls.projects[0].resolve(projects(1))
  await loading
  assert.equal(store.currentOrganizationId, 'o2')
  assert.equal(store.currentProjectId, 'p2')
  assert.deepEqual(store.projects, projects(2))
})
test('explicit project selection wins over pending project fallback', async () => {
  const store = initial()
  store.projects = [...projects(1), { id: 'p-other', organizationId: 'o1' }]
  const loading = store.loadProjects()
  store.switchProject('p-other')
  calls.projects[0].resolve(projects(1))
  await loading
  assert.equal(store.currentProjectId, 'p-other')
})
test('older organization switches cannot overwrite newer projects or subscription', async () => {
  const store = initial()
  const older = store.switchOrganization('o2')
  const newer = store.switchOrganization('o3')
  calls.projects[1].resolve(projects(3))
  calls.subscription[1].resolve({ effectivePlan: { name: 'new' }, stack: [] })
  await newer
  calls.projects[0].resolve(projects(2))
  calls.subscription[0].resolve({ effectivePlan: { name: 'old' }, stack: [] })
  await older
  assert.equal(store.currentOrganizationId, 'o3')
  assert.equal(store.currentProjectId, 'p3')
  assert.equal(store.currentPlan.name, 'new')
})
test('late organization initialization cannot clear a resolved workspace', async () => {
  const store = initial()
  const loading = store.loadOrganizations()
  store.applyWorkspace('o2', 'p2', orgs, projects(2), store.workspaceRevision)
  calls.organizations[0].resolve([{ id: 'o1' }])
  await loading
  assert.equal(store.currentOrganizationId, 'o2')
  assert.equal(store.currentProjectId, 'p2')
  assert.equal(calls.subscription.length, 0)
})
test('stale deep-link commits are rejected after user selection', () => {
  const store = initial()
  const revision = store.workspaceRevision
  store.switchProject('p-other')
  assert.equal(store.applyWorkspace('o2', 'p2', orgs, projects(2), revision), false)
  assert.equal(store.currentOrganizationId, 'o1')
  assert.equal(store.currentProjectId, 'p-other')
})
test('reset invalidates all in-flight data and subscription requests', async () => {
  const store = initial()
  const loading = store.loadProjects()
  const subscription = store.loadSubscription()
  store.reset()
  calls.projects[0].resolve(projects(1))
  calls.subscription[0].resolve({ effectivePlan: { name: 'old' }, stack: [] })
  await Promise.all([loading, subscription])
  assert.equal(store.currentOrganizationId, '')
  assert.equal(store.currentProjectId, '')
  assert.deepEqual(store.projects, [])
  assert.equal(store.subscription, null)
})
test('newer same-organization refresh wins if responses are reversed', async () => {
  const store = initial()
  const older = store.loadProjects()
  const newer = store.loadProjects()
  const fresh = [...projects(1), { id: 'new', organizationId: 'o1' }]
  calls.projects[1].resolve(fresh)
  await newer
  calls.projects[0].resolve(projects(1))
  await older
  assert.deepEqual(store.projects, fresh)
})
