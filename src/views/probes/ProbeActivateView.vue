<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { listOrganizations } from '@/api/modules/organization'
import { approveProbeActivation, getProbeActivation } from '@/api/modules/probe'
import type { Organization } from '@/api/types'
import type { ProbeActivation, ProbeActivationApproval, ProbeProvider } from '@/api/types/probe'
import AppIcon from '@/components/AppIcon.vue'
import { useProbeActions } from '@/composables/useProbeActions'
import { RefreshIcon, SecurityCheckIcon } from '@/icons'
import { useOrganizationStore, useUserStore } from '@/stores'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'
import { PROBE_PROVIDERS, probeProviderLabelKey } from '@/utils/admin-presenter'
import { formatDateTime } from '@/utils/billing'
import { probeActivationCode, probeFormError } from '@/utils/probe-presenter'
import { ApiError } from '@/utils/request'

defineOptions({ name: 'ProbeActivateView' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const workspace = useOrganizationStore()
const user = useUserStore()
const permissions = usePermissionsStore()
const code = computed(() => probeActivationCode(route.query.code))
const codeInput = ref('')
const activation = ref<ProbeActivation | null>(null)
const approval = ref<ProbeActivationApproval | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'expired' | 'error'>('idle')
const loadError = ref('')
const formError = ref('')
const organizations = ref<Organization[]>([])
const teamsLoading = ref(false)
const teamsError = ref('')
const submitting = ref(false)
const opening = ref(false)
const form = reactive({
  organizationId: '',
  name: '',
  region: '',
  provider: 'CUSTOM' as ProbeProvider,
})
const { run, error: actionError } = useProbeActions(() => form.organizationId)
const teams = computed(() =>
  organizations.value.filter((organization) => permissions.canOrganization(organization.id)),
)
const pending = computed(() => state.value === 'ready' && activation.value?.status === 'pending')
const locked = computed(() => submitting.value || teamsLoading.value || !!approval.value)
const host = computed(() => activation.value?.client.hostname ?? '')
let generation = 0
let teamsGeneration = 0
let controller: AbortController | undefined

async function loadTeams() {
  if (!user.isLogin || !pending.value || approval.value) return
  const request = ++teamsGeneration
  const context = accessContext()
  teamsLoading.value = true
  teamsError.value = ''
  try {
    const result = await listOrganizations()
    if (request !== teamsGeneration || !isCurrentContext(context)) return
    organizations.value = result
    for (const organization of result) {
      await permissions.ensureOrganization(organization.id, true)
      if (request !== teamsGeneration || !isCurrentContext(context)) return
    }
    if (
      result.some((organization) => permissions.organizations[organization.id]?.state === 'error')
    )
      teamsError.value = t('probePage.activation.teamsFailed')
    if (!form.organizationId) {
      form.organizationId =
        teams.value.find((organization) => organization.id === workspace.currentOrganizationId)
          ?.id ??
        teams.value[0]?.id ??
        ''
    } else if (!teams.value.some((organization) => organization.id === form.organizationId)) {
      form.organizationId = ''
    }
  } catch (cause) {
    if (request === teamsGeneration && isCurrentContext(context))
      teamsError.value =
        cause instanceof Error ? cause.message : t('probePage.activation.teamsFailed')
  } finally {
    if (request === teamsGeneration) teamsLoading.value = false
  }
}

async function loadActivation() {
  const request = ++generation
  controller?.abort()
  controller = new AbortController()
  const context = accessContext()
  activation.value = null
  loadError.value = ''
  if (!code.value || !user.isLogin) {
    state.value = 'idle'
    return false
  }
  state.value = 'loading'
  try {
    const result = await getProbeActivation(code.value, {
      signal: controller.signal,
      headers: { 'X-Silent-Error': true },
    })
    if (request !== generation || !isCurrentContext(context, true)) return false
    if (
      !result ||
      probeActivationCode(result.userCode) !== code.value ||
      !['pending', 'approved', 'denied'].includes(result.status) ||
      !Number.isFinite(Date.parse(result.requestedAt)) ||
      !result.client
    )
      throw new Error(t('probePage.activation.invalidResponse'))
    activation.value = result
    state.value = 'ready'
    return result.status === 'pending'
  } catch (cause) {
    if (request !== generation || !isCurrentContext(context, true)) return false
    state.value = cause instanceof ApiError && cause.status === 404 ? 'expired' : 'error'
    loadError.value = cause instanceof Error ? cause.message : t('probePage.activation.loadFailed')
    return false
  }
}

async function initialize() {
  teamsGeneration++
  organizations.value = []
  teamsLoading.value = false
  teamsError.value = ''
  approval.value = null
  formError.value = ''
  actionError.value = ''
  Object.assign(form, { organizationId: '', name: '', region: '', provider: 'CUSTOM' })
  await retry()
}
async function retry() {
  if (await loadActivation()) {
    if (!form.name) form.name = host.value.slice(0, 100)
    await loadTeams()
  }
}
watch(code, () => void initialize(), { immediate: true })
watch(permissionEpoch, () => {
  formError.value = ''
  void loadTeams()
})
watch(sessionEpoch, () => {
  generation++
  teamsGeneration++
  controller?.abort()
  activation.value = null
  approval.value = null
  organizations.value = []
  Object.assign(form, { organizationId: '', name: '', region: '', provider: 'CUSTOM' })
})
onScopeDispose(() => {
  generation++
  teamsGeneration++
  controller?.abort()
})

async function enterCode() {
  const value = probeActivationCode(codeInput.value)
  formError.value = value ? '' : t('probePage.activation.invalidCode')
  if (value) await router.replace({ path: '/activate', query: { code: value } })
}
async function confirm() {
  if (submitting.value || !pending.value || approval.value) return
  const problem = probeFormError({ ...form, callbackUrl: '' }, true)
  formError.value = !form.organizationId
    ? t('probePage.activation.teamRequired')
    : problem
      ? t(`probePage.${problem}`)
      : ''
  if (formError.value || !permissions.canOrganization(form.organizationId)) return
  const payload = {
    userCode: code.value,
    organizationId: form.organizationId,
    name: form.name.trim(),
    region: form.region.trim(),
    provider: form.provider,
  }
  const context = accessContext()
  submitting.value = true
  try {
    if (!(await loadActivation()) || !isCurrentContext(context)) return
    const request = generation
    const result = await run('approve', () =>
      approveProbeActivation(payload, { headers: { 'X-Silent-Error': true } }),
    )
    if (!result || request !== generation || !isCurrentContext(context)) return
    if (
      result.status !== 'approved' ||
      result.organizationId !== payload.organizationId ||
      !result.probeId
    )
      throw new Error(t('probePage.activation.invalidResponse'))
    approval.value = result
  } catch (cause) {
    if (isCurrentContext(context))
      formError.value =
        cause instanceof Error ? cause.message : t('probePage.activation.saveFailed')
  } finally {
    submitting.value = false
  }
}
async function viewNodes() {
  if (!approval.value || opening.value) return
  opening.value = true
  try {
    await workspace.switchOrganization(approval.value.organizationId)
    await router.push('/probes')
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <div class="probe-activate">
    <h2>{{ t(approval ? 'probePage.activation.success' : 'probePage.activation.title') }}</h2>
    <template v-if="approval">
      <t-alert theme="success" :message="t('probePage.activation.successDescription')" />
      <t-button :loading="opening" @click="viewNodes">{{
        t('probePage.activation.viewNodes')
      }}</t-button>
    </template>
    <form v-else-if="!code" class="probe-activate__form" @submit.prevent="enterCode">
      <label>
        <span>{{ t('probePage.activation.code') }}</span>
        <t-input
          v-model="codeInput"
          :maxlength="32"
          :placeholder="t('probePage.activation.codePlaceholder')"
        />
      </label>
      <t-alert
        v-if="formError || route.query.code"
        theme="error"
        :message="formError || t('probePage.activation.invalidCode')"
      />
      <div class="probe-activate__actions">
        <t-button type="submit">{{ t('probePage.activation.continue') }}</t-button>
      </div>
    </form>
    <p v-else-if="state === 'loading'">{{ t('common.loading') }}</p>
    <template v-else-if="state === 'expired' || activation?.status === 'denied'">
      <t-alert
        theme="error"
        :message="
          t(state === 'expired' ? 'probePage.activation.expired' : 'probePage.activation.denied')
        "
      />
    </template>
    <template v-else-if="state === 'error'">
      <t-alert theme="error" :message="loadError" />
      <t-button variant="outline" @click="retry">
        <template #icon><AppIcon :icon="RefreshIcon" /></template>
        {{ t('probePage.retry') }}
      </t-button>
    </template>
    <t-alert
      v-else-if="activation?.status === 'approved'"
      theme="info"
      :message="t('probePage.activation.alreadyApproved')"
    />
    <form v-else-if="pending" class="probe-activate__form" @submit.prevent="confirm">
      <dl class="probe-activate__device">
        <dt>{{ t('probePage.activation.code') }}</dt>
        <dd>{{ code }}</dd>
        <template v-if="host"
          ><dt>{{ t('probePage.activation.hostname') }}</dt>
          <dd>{{ host }}</dd></template
        >
        <template v-if="activation?.client.platform"
          ><dt>{{ t('probePage.activation.platform') }}</dt>
          <dd>{{ activation.client.platform }}</dd></template
        >
        <dt>{{ t('probePage.activation.requestedAt') }}</dt>
        <dd>{{ formatDateTime(activation!.requestedAt) }}</dd>
      </dl>
      <t-alert v-if="teamsError" theme="error" :message="teamsError">
        <template #operation
          ><t-button variant="text" @click="loadTeams">{{
            t('probePage.retry')
          }}</t-button></template
        >
      </t-alert>
      <t-alert
        v-else-if="!teamsLoading && !teams.length"
        theme="warning"
        :message="t('probePage.activation.noTeams')"
      />
      <label>
        <span>{{ t('probePage.activation.team') }}</span>
        <t-select
          v-model="form.organizationId"
          :disabled="locked"
          :loading="teamsLoading"
          :placeholder="t('probePage.activation.teamPlaceholder')"
          :options="
            teams.map((organization) => ({ label: organization.name, value: organization.id }))
          "
        />
      </label>
      <label>
        <span>{{ t('probePage.name') }}</span>
        <t-input
          v-model="form.name"
          :disabled="locked"
          :maxlength="100"
          :placeholder="t('probePage.namePlaceholder')"
        />
      </label>
      <label>
        <span>{{ t('probePage.region') }}</span>
        <t-input
          v-model="form.region"
          :disabled="locked"
          :maxlength="100"
          :placeholder="t('probePage.regionPlaceholder')"
        />
      </label>
      <label>
        <span>{{ t('probePage.provider') }}</span>
        <t-select
          v-model="form.provider"
          :disabled="locked"
          :options="
            PROBE_PROVIDERS.map((value) => ({ value, label: t(probeProviderLabelKey(value)) }))
          "
        />
      </label>
      <t-alert v-if="formError || actionError" theme="error" :message="formError || actionError" />
      <div class="probe-activate__actions">
        <t-button variant="outline" :disabled="submitting" @click="router.push('/team')">{{
          t('common.cancel')
        }}</t-button>
        <t-button
          type="submit"
          :loading="submitting"
          :disabled="teamsLoading || !permissions.canOrganization(form.organizationId)"
        >
          <template #icon><AppIcon :icon="SecurityCheckIcon" /></template>
          {{ t('probePage.activation.confirm') }}
        </t-button>
      </div>
    </form>
  </div>
</template>

<style scoped lang="less">
.probe-activate {
  display: grid;
  gap: 20px;
  width: min(100%, 560px);
  padding: 40px 24px;
  margin: 0 auto;
  h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.4;
  }
  &__form {
    display: grid;
    gap: 20px;
    min-width: 0;
  }
  &__form > label {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
    font-size: 13px;
  }
  &__device {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    gap: 8px 16px;
    padding-bottom: 20px;
    margin: 0;
    border-bottom: 1px solid @beacon-border;
    font-size: 13px;
    line-height: 1.6;
    dt {
      color: @beacon-text-secondary;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }
  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 12px;
  }
  @media (max-width: 600px) {
    padding: 24px 16px;
  }
}
</style>
