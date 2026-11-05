export default {
  title: 'Monitor capacity',
  WITHIN_LIMIT: 'No downgrade restriction',
  GRACE: 'Downgrade grace period',
  LIMITED: 'Capacity restriction active',
  summary: '{total} configured · {limit} plan slots · {excess} over limit',
  grace:
    'A downgrade provides a 72-hour grace period. Monitors without a retained slot stop observing at their individual deadlines. Configuration and history are preserved.',
  limited:
    'Some monitors have stopped observing due to the plan limit. Historical healthy states do not indicate current health. Change retained monitors, remove excess monitors, or renew / upgrade.',
  within:
    'No active downgrade restriction. Creating and restoring monitors still requires space within the configuration quota.',
  deadline: 'This cycle ends: {time}',
  rules:
    'Choose up to {limit} priority monitors. Empty or unfilled selections are filled by creation time, then ID, in ascending order. Manually paused monitors still use slots; deleting a project does not reduce configuration usage.',
  recovery: 'Restored monitors await a new observation. Manually paused monitors remain paused.',
  selected: '{count} / {limit} priority selections',
  search: 'Search monitor or project name',
  monitor: 'Monitor / project',
  priority: 'Priority',
  actual: 'Current capacity allocation',
  retained: 'Slot retained',
  graceRow: 'In grace period',
  restricted: 'Observation stopped',
  paused: 'Manually paused',
  unavailable: 'Unavailable monitor ({id})',
  unavailableHint:
    'The project may have been deleted. This configuration still uses capacity and cannot be selected again.',
  empty: 'No matching monitors',
  save: 'Save priority monitors',
  confirm:
    'Saving immediately recalculates slots using the current plan and individual deadlines. Observation may stop or resume. Grace periods will not be extended. Continue?',
  saved: 'Retained monitors updated',
  reset: 'Use default order',
  resetConfirm:
    'Clear priority selections and save to allocate slots by creation time, then ID. Observation may stop or resume immediately. Continue?',
  refresh: 'Refresh status',
  refreshConfirm: 'Refreshing discards unsaved selections. Continue?',
  upgrade: 'Renew / upgrade',
  manage: 'Manage monitor capacity',
  blocked:
    'Observation stopped because the monitor count exceeds the plan limit. An organization admin can change retained monitors or renew / upgrade.',
  loadFailed: 'Could not load monitor capacity. Please retry.',
  monitorsFailed:
    'Some project monitors could not be loaded. Saving is disabled. Please refresh and retry.',
  saveFailed: 'Could not save retained monitors.',
  selectionRefreshed:
    'Saving did not complete. A refresh of capacity and selections was attempted. Review the latest state before selecting again.',
}
