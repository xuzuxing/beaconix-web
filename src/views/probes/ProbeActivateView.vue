<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { listOrganizations } from '@/api/modules/organization'
import { approveProbeActivation, getProbeActivation } from '@/api/modules/probe'
import type { Organization } from '@/api/types'
import type {
  ApproveProbeActivationParams,
  ProbeActivation,
  ProbeActivationApproval,
  ProbeActivationScope,
  ProbeProvider,
} from '@/api/types/probe'
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
  scope: 'TENANT' as ProbeActivationScope,
  organizationId: '',
  name: '',
  region: '',
  provider: 'CUSTOM' as ProbeProvider,
})
const { run, error: actionError } = useProbeActions(() => form.organizationId)
const teams = computed(() =>
  organizations.value.filter((organization) =>
    permissions.canOrganization(organization.id),
  ),
)
const pending = computed(
  () => state.value === 'ready' && activation.value?.status === 'pending',
)
const locked = computed(
  () => submitting.value || teamsLoading.value || !!approval.value,
)
const host = computed(() => activation.value?.client.hostname ?? '')
const canChooseSystem = computed(() => user.isSuperAdmin)
const isSystem = computed(
  () => form.scope === 'SYSTEM' && canChooseSystem.value,
)
const approvalScope = computed<ProbeActivationScope>(() => {
  const value = approval.value
  if (!value) return 'TENANT'
  return value.scope ?? (value.organizationId ? 'TENANT' : 'SYSTEM')
})
let generation = 0
let teamsGeneration = 0
let controller: AbortController | undefined

async function loadTeams() {
  if (!user.isLogin || !pending.value || approval.value || isSystem.value)
    return
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
      result.some(
        (organization) =>
          permissions.organizations[organization.id]?.state === 'error',
      )
    )
      teamsError.value = t('probePage.activation.teamsFailed')
    if (!form.organizationId) {
      form.organizationId =
        teams.value.find(
          (organization) => organization.id === workspace.currentOrganizationId,
        )?.id ??
        teams.value[0]?.id ??
        ''
    } else if (
      !teams.value.some(
        (organization) => organization.id === form.organizationId,
      )
    ) {
      form.organizationId = ''
    }
  } catch (cause) {
    if (request === teamsGeneration && isCurrentContext(context))
      teamsError.value =
        cause instanceof Error
          ? cause.message
          : t('probePage.activation.teamsFailed')
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
    state.value =
      cause instanceof ApiError && cause.status === 404 ? 'expired' : 'error'
    loadError.value =
      cause instanceof Error
        ? cause.message
        : t('probePage.activation.loadFailed')
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
  Object.assign(form, {
    scope: 'TENANT' as ProbeActivationScope,
    organizationId: '',
    name: '',
    region: '',
    provider: 'CUSTOM',
  })
  await retry()
}
async function retry() {
  if (await loadActivation()) {
    if (!form.name) form.name = host.value.slice(0, 100)
    await loadTeams()
  }
}
watch(code, () => void initialize(), { immediate: true })
watch(
  () => form.scope,
  (scope) => {
    formError.value = ''
    actionError.value = ''
    if (scope === 'TENANT') void loadTeams()
  },
)
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
  Object.assign(form, {
    scope: 'TENANT' as ProbeActivationScope,
    organizationId: '',
    name: '',
    region: '',
    provider: 'CUSTOM',
  })
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
  const system = isSystem.value
  const problem = probeFormError({ ...form, callbackUrl: '' }, true)
  formError.value =
    !system && !form.organizationId
      ? t('probePage.activation.teamRequired')
      : problem
        ? t(`probePage.${problem}`)
        : ''
  if (
    formError.value ||
    (!system && !permissions.canOrganization(form.organizationId))
  )
    return
  const payload: ApproveProbeActivationParams = {
    userCode: code.value,
    scope: form.scope,
    name: form.name.trim(),
    region: form.region.trim(),
    provider: form.provider,
    ...(system ? {} : { organizationId: form.organizationId }),
  }
  const context = accessContext()
  submitting.value = true
  try {
    if (!(await loadActivation()) || !isCurrentContext(context)) return
    const request = generation
    // System probes have no organization to revalidate, so they bypass the
    // organization-scoped useProbeActions guard and call the API directly.
    const result = system
      ? await approveProbeActivation(payload, {
          headers: { 'X-Silent-Error': true },
        })
      : await run('approve', () =>
          approveProbeActivation(payload, {
            headers: { 'X-Silent-Error': true },
          }),
        )
    if (!result || request !== generation || !isCurrentContext(context)) return
    const resultScope =
      result.scope ?? (result.organizationId ? 'TENANT' : 'SYSTEM')
    if (
      result.status !== 'approved' ||
      resultScope !== form.scope ||
      (system
        ? result.organizationId != null
        : result.organizationId !== payload.organizationId) ||
      !result.probeId
    )
      throw new Error(t('probePage.activation.invalidResponse'))
    approval.value = result
  } catch (cause) {
    if (isCurrentContext(context))
      formError.value =
        cause instanceof Error
          ? cause.message
          : t('probePage.activation.saveFailed')
  } finally {
    submitting.value = false
  }
}
async function viewNodes() {
  if (!approval.value || opening.value) return
  opening.value = true
  try {
    if (approvalScope.value === 'SYSTEM' || !approval.value.organizationId) {
      await router.push('/admin/system-probes')
      return
    }
    await workspace.switchOrganization(approval.value.organizationId)
    await router.push('/probes')
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <div class="probe-activate">
    <header class="probe-activate__hero">
      <span class="probe-activate__hero-icon">
        <AppIcon :icon="SecurityCheckIcon" />
      </span>
      <div class="probe-activate__hero-text">
        <h2>
          {{
            t(
              approval
                ? 'probePage.activation.success'
                : 'probePage.activation.title',
            )
          }}
        </h2>
        <p v-if="!approval">{{ t('probePage.activation.subtitle') }}</p>
      </div>
    </header>

    <section
      v-if="approval"
      class="probe-activate__card probe-activate__success"
    >
      <t-alert
        theme="success"
        :message="
          t(
            approvalScope === 'SYSTEM'
              ? 'probePage.activation.successSystemDescription'
              : 'probePage.activation.successDescription',
          )
        "
      />
      <t-button
        :loading="opening"
        @click="viewNodes"
      >
        {{
          t(
            approvalScope === 'SYSTEM'
              ? 'probePage.activation.viewSystemProbes'
              : 'probePage.activation.viewNodes',
          )
        }}
      </t-button>
    </section>

    <form
      v-else-if="!code"
      class="probe-activate__card probe-activate__form"
      @submit.prevent="enterCode"
    >
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
        <t-button type="submit">{{
          t('probePage.activation.continue')
        }}</t-button>
      </div>
    </form>

    <section
      v-else-if="state === 'loading'"
      class="probe-activate__card probe-activate__muted"
    >
      <p>{{ t('common.loading') }}</p>
    </section>

    <section
      v-else-if="state === 'expired' || activation?.status === 'denied'"
      class="probe-activate__card"
    >
      <t-alert
        theme="error"
        :message="
          t(
            state === 'expired'
              ? 'probePage.activation.expired'
              : 'probePage.activation.denied',
          )
        "
      />
    </section>

    <section
      v-else-if="state === 'error'"
      class="probe-activate__card"
    >
      <t-alert
        theme="error"
        :message="loadError"
      />
      <div class="probe-activate__actions">
        <t-button
          variant="outline"
          @click="retry"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
          {{ t('probePage.retry') }}
        </t-button>
      </div>
    </section>

    <section
      v-else-if="activation?.status === 'approved'"
      class="probe-activate__card"
    >
      <t-alert
        theme="info"
        :message="t('probePage.activation.alreadyApproved')"
      />
    </section>

    <form
      v-else-if="pending"
      class="probe-activate__card probe-activate__form"
      @submit.prevent="confirm"
    >
      <div class="probe-activate__section">
        <p class="probe-activate__section-title">
          {{ t('probePage.activation.deviceSection') }}
        </p>
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
      </div>

      <div class="probe-activate__section">
        <p class="probe-activate__section-title">
          {{ t('probePage.activation.probeSection') }}
        </p>

        <div
          v-if="canChooseSystem"
          class="probe-activate__scope"
        >
          <span class="probe-activate__scope-label">{{
            t('probePage.activation.scope')
          }}</span>
          <t-radio-group
            v-model="form.scope"
            variant="default-filled"
            :disabled="locked"
          >
            <t-radio-button value="TENANT">{{
              t('probePage.activation.scopeTenant')
            }}</t-radio-button>
            <t-radio-button value="SYSTEM">{{
              t('probePage.activation.scopeSystem')
            }}</t-radio-button>
          </t-radio-group>
        </div>

        <t-alert
          v-if="isSystem"
          theme="info"
          :message="t('probePage.activation.scopeSystemHint')"
        />

        <t-alert
          v-if="teamsError && !isSystem"
          theme="error"
          :message="teamsError"
        >
          <template #operation
            ><t-button
              variant="text"
              @click="loadTeams"
              >{{ t('probePage.retry') }}</t-button
            ></template
          >
        </t-alert>
        <t-alert
          v-else-if="!isSystem && !teamsLoading && !teams.length"
          theme="warning"
          :message="t('probePage.activation.noTeams')"
        />

        <div class="probe-activate__fields">
          <label v-if="!isSystem">
            <span>{{ t('probePage.activation.team') }}</span>
            <t-select
              v-model="form.organizationId"
              :disabled="locked"
              :loading="teamsLoading"
              :placeholder="t('probePage.activation.teamPlaceholder')"
              :options="
                teams.map((organization) => ({
                  label: organization.name,
                  value: organization.id,
                }))
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
                PROBE_PROVIDERS.map((value) => ({
                  value,
                  label: t(probeProviderLabelKey(value)),
                }))
              "
            />
          </label>
        </div>
      </div>

      <t-alert
        v-if="formError || actionError"
        theme="error"
        :message="formError || actionError"
      />
      <div class="probe-activate__actions">
        <t-button
          variant="outline"
          :disabled="submitting"
          @click="router.push('/team')"
          >{{ t('common.cancel') }}</t-button
        >
        <t-button
          type="submit"
          :loading="submitting"
          :disabled="
            (!isSystem &&
              (teamsLoading ||
                !permissions.canOrganization(form.organizationId))) ||
            (isSystem && !user.isSuperAdmin)
          "
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
  width: min(100%, 640px);
  padding: 40px 24px;
  margin: 0 auto;

  &__hero {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  &__hero-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 42px;
    height: 42px;
    font-size: 22px;
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
    border-radius: 12px;
  }
  &__hero-text {
    display: grid;
    gap: 6px;
    min-width: 0;
    h2 {
      margin: 0;
      font-size: 20px;
      line-height: 1.35;
    }
    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: @beacon-text-secondary;
    }
  }
  &__card {
    display: grid;
    gap: 20px;
    padding: 24px;
    background: var(--td-bg-color-container);
    border: 1px solid @beacon-border;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  }
  &__success {
    justify-items: start;
  }
  &__muted {
    font-size: 13px;
    color: @beacon-text-secondary;
    p {
      margin: 0;
    }
  }
  &__form {
    min-width: 0;
  }
  &__section {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  &__section-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: @beacon-text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  &__device {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 8px 16px;
    padding: 14px 16px;
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    background: var(--td-bg-color-container-hover);
    border-radius: 12px;
    dt {
      color: @beacon-text-secondary;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }
  &__scope {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    font-size: 13px;
    border: 1px solid @beacon-border;
    border-radius: 12px;
  }
  &__scope-label {
    font-weight: 500;
  }
  &__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    min-width: 0;
  }
  &__fields > label {
    display: grid;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 4px;
  }
  @media (max-width: 600px) {
    padding: 24px 16px;
    &__card {
      padding: 20px 16px;
    }
    &__fields {
      grid-template-columns: minmax(0, 1fr);
    }
    &__device {
      grid-template-columns: minmax(0, 1fr);
      gap: 4px;
      dt {
        font-weight: 600;
      }
    }
  }
}
</style>
