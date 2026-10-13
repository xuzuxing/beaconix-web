import { ref } from 'vue'

export const sessionEpoch = ref(0)
export const permissionEpoch = ref(0)
export const workspaceEpoch = ref(0)

export function accessContext() {
  return {
    session: sessionEpoch.value,
    permission: permissionEpoch.value,
    workspace: workspaceEpoch.value,
  }
}
export function isCurrentContext(context: ReturnType<typeof accessContext>, accountOnly = false) {
  return (
    context.session === sessionEpoch.value &&
    (accountOnly ||
      (context.permission === permissionEpoch.value && context.workspace === workspaceEpoch.value))
  )
}
export class StaleAccessError extends Error {
  constructor() {
    super('Request context changed')
    this.name = 'StaleAccessError'
  }
}
export function invalidatePermissions() {
  permissionEpoch.value++
}
export function invalidateWorkspace() {
  workspaceEpoch.value++
  invalidatePermissions()
}
export function invalidateSession() {
  sessionEpoch.value++
  invalidateWorkspace()
}
