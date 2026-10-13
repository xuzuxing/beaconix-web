<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { deleteProbe, rotateProbeSecret, updateProbe, validateProbe } from '@/api/modules/probe'
import type { TenantProbe, ProbeValidationChallenge } from '@/api/types/probe'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import ProbeEditorDialog from '@/components/probes/ProbeEditorDialog.vue'
import ProbeDetailDrawer from '@/components/probes/ProbeDetailDrawer.vue'
import ProbeCredentialDialog, {
  type ProbeCredential,
} from '@/components/probes/ProbeCredentialDialog.vue'
import SystemProbeValidateDialog from '@/components/admin/SystemProbeValidateDialog.vue'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { useProbeActions } from '@/composables/useProbeActions'
import { useProbeList } from '@/composables/useProbeList'
import {
  Delete02Icon,
  Edit02Icon,
  InformationCircleIcon,
  LockPasswordIcon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  ServerIcon,
} from '@/icons'
import { useOrganizationStore } from '@/stores'
import { permissionEpoch, sessionEpoch } from '@/utils/access-context'
import { PROBE_PROVIDERS, probeProviderLabelKey, probeProviderTheme } from '@/utils/admin-presenter'
import { formatDateTime } from '@/utils/billing'
import { selectProbes } from '@/utils/probe-presenter'

defineOptions({ name: 'ProbesView' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)
const { canManage } = useOrganizationRole()
const { probes, loading, error, load } = useProbeList(orgId)
const { busy, error: actionError, run } = useProbeActions(orgId)
const editor = ref(false)
const editing = ref<TenantProbe>()
const detail = ref(false)
const detailId = ref('')
const credential = ref<ProbeCredential | null>(null)
const challenge = ref<ProbeValidationChallenge | null>(null)
const validateVisible = ref(false)
const validatingName = ref('')
const confirmation = ref<{ probe: TenantProbe; action: 'delete' | 'rotate' }>()
const query = (key: string) =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
function setQuery(key: string, value: string) {
  void router.replace({
    query: {
      ...route.query,
      [key]: value === 'all' || !value ? undefined : value,
      page: undefined,
    },
  })
}
const search = computed({ get: () => query('q'), set: (value) => setQuery('q', value) })
const status = computed({
  get: () =>
    ['ONLINE', 'OFFLINE', 'disabled'].includes(query('status')) ? query('status') : 'all',
  set: (value) => setQuery('status', value),
})
const provider = computed({
  get: () =>
    PROBE_PROVIDERS.some((value) => value === query('provider')) ? query('provider') : 'all',
  set: (value) => setQuery('provider', value),
})
const size = computed(() =>
  [10, 20, 50].includes(Number(query('size'))) ? Number(query('size')) : 10,
)
const filtered = computed(() =>
  selectProbes(probes.value, search.value, status.value, provider.value),
)
const page = computed(() =>
  Math.min(
    Math.max(1, Math.floor(Number(query('page'))) || 1),
    Math.max(1, Math.ceil(filtered.value.length / size.value)),
  ),
)
const rows = computed(() =>
  filtered.value.slice((page.value - 1) * size.value, page.value * size.value),
)
function clearDialogs() {
  editor.value = false
  editing.value = undefined
  detail.value = false
  detailId.value = ''
  credential.value = null
  challenge.value = null
  validateVisible.value = false
  validatingName.value = ''
  confirmation.value = undefined
}
watch([orgId, permissionEpoch, sessionEpoch], clearDialogs, { flush: 'sync' })
watch(
  canManage,
  (value) => {
    if (!value) clearDialogs()
  },
  { flush: 'sync' },
)
onScopeDispose(clearDialogs)
function edit(probe?: TenantProbe) {
  if (!canManage.value || busy.value) return
  editing.value = probe
  editor.value = true
}
function openDetail(probe: TenantProbe) {
  if (!canManage.value) return
  detailId.value = probe.id
  detail.value = true
}
async function toggle(probe: TenantProbe, enabled: unknown) {
  const result = await run(probe.id, (id) =>
    updateProbe(id, probe.id, { enabled: Boolean(enabled) }),
  )
  if (!result) return
  MessagePlugin.success(t('probePage.toggleDone'))
  void load()
}
async function validate(probe: TenantProbe) {
  const result = await run(probe.id, (id) => validateProbe(id, probe.id))
  if (!result) return
  challenge.value = result
  validatingName.value = probe.name
  validateVisible.value = true
  MessagePlugin.success(t('probePage.validateCreated'))
}
async function confirm() {
  const current = confirmation.value
  if (!current) return
  if (current.action === 'delete') {
    const result = await run(current.probe.id, (id) => deleteProbe(id, current.probe.id))
    if (!result) return
    MessagePlugin.success(t('probePage.deleted'))
  } else {
    const result = await run(current.probe.id, (id) => rotateProbeSecret(id, current.probe.id))
    if (!result) return
    if (result.secret)
      credential.value = {
        kind: 'rotate',
        name: result.name,
        probeId: result.id,
        value: result.secret,
      }
    else MessagePlugin.warning(t('probePage.secretMissing'))
    MessagePlugin.success(t('probePage.rotated'))
  }
  confirmation.value = undefined
  void load()
}
function showCredential(value: ProbeCredential) {
  if (canManage.value) credential.value = value
}
function paginate({ current, pageSize }: { current: number; pageSize: number }) {
  void router.replace({ query: { ...route.query, page: String(current), size: String(pageSize) } })
}
</script>

<template>
  <section class="probe-page">
    <HeaderActions>
      <t-tooltip :content="t('probePage.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!canManage"
          :aria-label="t('probePage.refresh')"
          @click="load"
          ><AppIcon :icon="RefreshIcon" /></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!!busy" @click="edit()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('probePage.create') }}</t-button
      >
    </HeaderActions>
    <t-alert v-if="!canManage" theme="info" :message="t('probePage.noPermission')" />
    <div v-else class="probe-page__surface">
      <header class="probe-page__head">
        <h3>{{ t('probePage.title') }}</h3>
        <span>{{ org.currentOrganization?.name }}</span>
      </header>
      <t-alert v-if="actionError" theme="error" :message="actionError" />
      <div class="probe-page__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('probePage.search')"
          :aria-label="t('probePage.search')"
        >
          <template #prefix-icon><AppIcon :icon="Search01Icon" /></template>
        </t-input>
        <t-select
          v-model="status"
          :aria-label="t('probePage.all')"
          :options="[
            { value: 'all', label: t('probePage.all') },
            { value: 'ONLINE', label: t('probePage.online') },
            { value: 'OFFLINE', label: t('probePage.offline') },
            { value: 'disabled', label: t('probePage.disabled') },
          ]"
        />
        <t-select
          v-model="provider"
          :aria-label="t('probePage.allProviders')"
          :options="[
            { value: 'all', label: t('probePage.allProviders') },
            ...PROBE_PROVIDERS.map((value) => ({ value, label: t(probeProviderLabelKey(value)) })),
          ]"
        />
      </div>
      <div v-if="error" class="probe-page__state">
        <t-alert theme="error" :message="error" /><t-button @click="load">{{
          t('probePage.retry')
        }}</t-button>
      </div>
      <div v-else-if="loading" class="probe-page__state">
        <t-loading :text="t('common.loading')" />
      </div>
      <template v-else-if="rows.length">
        <div class="probe-page__table-head">
          <span>{{ t('probePage.name') }}</span
          ><span>{{ t('probePage.region') }}</span
          ><span>{{ t('probePage.status') }}</span> <span>{{ t('probePage.heartbeat') }}</span
          ><span>{{ t('probePage.monitors') }}</span
          ><span>{{ t('probePage.actions') }}</span>
        </div>
        <article v-for="probe in rows" :key="probe.id" class="probe-row">
          <div class="probe-row__identity">
            <button class="probe-row__name" @click="openDetail(probe)">
              <AppIcon :icon="ServerIcon" />{{ probe.name }}
            </button>
            <small>{{ probe.id }}</small>
            <t-tag size="small" variant="light" :theme="probeProviderTheme(probe.provider)">{{
              t(probeProviderLabelKey(probe.provider))
            }}</t-tag>
          </div>
          <span class="probe-row__region">{{ probe.region }}</span>
          <div class="probe-row__status">
            <t-tag
              size="small"
              variant="light"
              :theme="!probe.enabled ? 'default' : probe.status === 'ONLINE' ? 'success' : 'danger'"
            >
              {{
                t(
                  !probe.enabled
                    ? 'probePage.disabled'
                    : probe.status === 'ONLINE'
                      ? 'probePage.online'
                      : 'probePage.offline',
                )
              }}
            </t-tag>
            <t-switch
              :value="probe.enabled"
              :loading="busy === probe.id"
              :disabled="!!busy || loading"
              :aria-label="`${t('probePage.enabledLabel')} ${probe.name}`"
              @change="(value: unknown) => toggle(probe, value)"
            />
          </div>
          <time class="probe-row__heartbeat">{{
            probe.lastHeartbeat ? formatDateTime(probe.lastHeartbeat) : t('probePage.never')
          }}</time>
          <span class="probe-row__count">{{ probe.monitors.length }}</span>
          <div class="probe-row__actions">
            <t-tooltip :content="t('probePage.detail')"
              ><t-button
                shape="square"
                variant="text"
                :aria-label="t('probePage.detail')"
                @click="openDetail(probe)"
                ><AppIcon :icon="InformationCircleIcon" /></t-button
            ></t-tooltip>
            <t-tooltip :content="t('probePage.edit')"
              ><t-button
                shape="square"
                variant="text"
                :disabled="!!busy"
                :aria-label="t('probePage.edit')"
                @click="edit(probe)"
                ><AppIcon :icon="Edit02Icon" /></t-button
            ></t-tooltip>
            <t-tooltip :content="t('probePage.validate')"
              ><t-button
                shape="square"
                variant="text"
                :disabled="!!busy || !probe.enabled"
                :aria-label="t('probePage.validate')"
                @click="validate(probe)"
                ><AppIcon :icon="SecurityCheckIcon" /></t-button
            ></t-tooltip>
            <t-tooltip :content="t('probePage.rotate')"
              ><t-button
                shape="square"
                variant="text"
                :disabled="!!busy"
                :aria-label="t('probePage.rotate')"
                @click="confirmation = { probe, action: 'rotate' }"
                ><AppIcon :icon="LockPasswordIcon" /></t-button
            ></t-tooltip>
            <t-tooltip :content="t('probePage.delete')"
              ><t-button
                shape="square"
                variant="text"
                theme="danger"
                :disabled="!!busy"
                :aria-label="t('probePage.delete')"
                @click="confirmation = { probe, action: 'delete' }"
                ><AppIcon :icon="Delete02Icon" /></t-button
            ></t-tooltip>
          </div>
        </article>
        <t-pagination
          :total="filtered.length"
          :current="page"
          :page-size="size"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div v-else class="probe-page__state">
        <AppIcon :icon="ServerIcon" :size="32" />
        <p>{{ t(probes.length ? 'probePage.noMatches' : 'probePage.empty') }}</p>
        <t-button v-if="probes.length" variant="outline" @click="router.replace({ query: {} })">{{
          t('probePage.reset')
        }}</t-button>
      </div>
    </div>
    <ProbeEditorDialog
      v-model:visible="editor"
      :org-id="orgId"
      :probe="editing"
      @saved="load"
      @credential="showCredential"
    />
    <ProbeCredentialDialog v-model:credential="credential" />
    <ProbeDetailDrawer
      v-model:visible="detail"
      :org-id="orgId"
      :probe-id="detailId"
      @changed="load"
    />
    <SystemProbeValidateDialog
      v-model:visible="validateVisible"
      :challenge="challenge"
      :probe-name="validatingName"
    />
    <t-dialog
      :visible="!!confirmation"
      :header="t(confirmation?.action === 'delete' ? 'probePage.delete' : 'probePage.rotate')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('common.confirm'), loading: !!busy }"
      :cancel-btn="t('common.cancel')"
      :close-on-overlay-click="!busy"
      @update:visible="
        (value: boolean) => {
          if (!value) confirmation = undefined
        }
      "
      @confirm="confirm"
    >
      <p class="probe-page__confirm">
        {{
          t(
            confirmation?.action === 'delete'
              ? 'probePage.deleteConfirm'
              : 'probePage.rotateConfirm',
            { name: confirmation?.probe.name ?? '' },
          )
        }}
      </p>
      <t-alert v-if="actionError" theme="error" :message="actionError" />
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.probe-page {
  min-width: 0;
  &__surface {
    background: @beacon-bg-container;
    padding: 20px;
  }
  &__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 16px;
  }
  h3 {
    font-size: 16px;
    margin: 0;
  }
  &__head > span {
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }
  &__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px 140px;
    gap: 8px;
    margin: 16px 0;
  }
  &__table-head,
  .probe-row {
    display: grid;
    grid-template-columns: minmax(170px, 1fr) minmax(80px, 110px) 110px 145px 70px 170px;
    gap: 12px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid @beacon-border;
  }
  &__table-head {
    background: @beacon-bg-page;
    font-size: 12px;
    color: @beacon-text-secondary;
    padding: 10px 8px;
  }
  &__state {
    display: flex;
    min-height: 240px;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    color: @beacon-text-secondary;
  }
  &__confirm {
    overflow-wrap: anywhere;
  }
  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}
.probe-row {
  min-width: 0;
  &__identity {
    display: grid;
    justify-items: start;
    gap: 6px;
    min-width: 0;
  }
  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    color: @beacon-text-primary;
    cursor: pointer;
    text-align: left;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  &__name :deep(svg) {
    flex-shrink: 0;
  }
  &__name:hover {
    color: @beacon-brand;
  }
  small {
    overflow-wrap: anywhere;
    font-size: 11px;
    color: @beacon-text-secondary;
  }
  &__region {
    overflow-wrap: anywhere;
  }
  &__status {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  &__heartbeat {
    font-size: 12px;
    color: @beacon-text-secondary;
  }
  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
  }
  @media (max-width: 1200px) {
    &__heartbeat {
      display: none;
    }
  }
}
@media (max-width: 1200px) {
  .probe-page__table-head,
  .probe-page .probe-row {
    grid-template-columns: minmax(150px, 1fr) 90px 110px 70px 170px;
  }
  .probe-page__table-head > :nth-child(4) {
    display: none;
  }
}
@media (max-width: 700px) {
  .probe-page__surface {
    padding: 12px;
  }
  .probe-page__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    > :first-child {
      grid-column: 1 / -1;
    }
  }
  .probe-page__table-head {
    display: none;
  }
  .probe-page .probe-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .probe-row__identity {
    grid-column: 1 / -1;
  }
  .probe-row__count {
    display: none;
  }
  .probe-row__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
  .probe-page :deep(.t-pagination__total) {
    flex: 0 0 100%;
    margin-right: 0;
  }
}
</style>
