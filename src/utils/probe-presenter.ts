import type { TenantProbe, CreateProbeParams, ProbeEnrollment } from '@/api/types/probe'

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function probeActivationCode(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32) return ''
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '')
  return /^[A-Z0-9]{8}$/.test(normalized) ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : ''
}

export function probeInstallCommand(enrollment: ProbeEnrollment): string {
  // Older API responses use equals-style options that the POSIX installer rejects.
  return enrollment.command
    .replace(`--token=${enrollment.token}`, `--token ${shellQuote(enrollment.token)}`)
    .replace(`--api-url=${enrollment.apiUrl}`, `--api-url ${shellQuote(enrollment.apiUrl)}`)
}

export function withoutProbeSecret(probe: TenantProbe): TenantProbe {
  const { secret: _secret, ...safe } = probe
  return safe
}

export function selectProbes(
  probes: readonly TenantProbe[],
  keyword: string,
  status = 'all',
  provider = 'all',
) {
  const query = keyword.trim().toLowerCase()
  return probes.filter(
    (probe) =>
      (status === 'all' ||
        (status === 'disabled' ? !probe.enabled : probe.enabled && probe.status === status)) &&
      (provider === 'all' || probe.provider === provider) &&
      (!query ||
        [probe.name, probe.id, probe.region, probe.callbackUrl].some((value) =>
          value.toLowerCase().includes(query),
        )),
  )
}

export function probeFormError(form: CreateProbeParams, install = false): string {
  if (!form.name.trim() || !form.region.trim()) return 'required'
  if (form.name.trim().length > 100 || form.region.trim().length > 100) return 'tooLong'
  if (install) return ''
  try {
    const url = new URL(form.callbackUrl.trim())
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      form.callbackUrl.length > 2048
    )
      return 'invalidUrl'
  } catch {
    return 'invalidUrl'
  }
  return ''
}
