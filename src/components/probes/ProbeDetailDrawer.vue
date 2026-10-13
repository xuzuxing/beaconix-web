<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { bindProbeMonitors, getProbe, unbindProbeMonitor } from '@/api/modules/probe'
import type { TenantProbe } from '@/api/types/probe'
import AppIcon from '@/components/AppIcon.vue'
import ProbeHistory from './ProbeHistory.vue'
import { useOrganizationMonitors } from '@/composables/useOrganizationMonitors'
import { useProbeActions } from '@/composables/useProbeActions'
import { RefreshIcon, PlusSignIcon, LinkSquare02Icon, Delete02Icon } from '@/icons'
import { usePermissionsStore } from '@/stores/modules/permissions'
import {
  accessContext,
  isCurrentContext,
  permissionEpoch,
  sessionEpoch,
} from '@/utils/access-context'
import { formatDateTime } from '@/utils/billing'
import { withoutProbeSecret } from '@/utils/probe-presenter'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; probeId: string }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()
const scope = computed(() =>
  visible.value && permissions.canOrganization(props.orgId) ? props.orgId : '',
)
const { busy, error: actionError, run } = useProbeActions(scope)
const probe = ref<TenantProbe>()
const loading = ref(false)
const error = ref('')
const tab = ref('monitors')
const binding = ref(false)
const selected = ref<string[]>([])
const bindError = ref('')
const removing = ref<string>()
const candidatesScope = computed(() => (binding.value ? scope.value : ''))
const {
  monitors,
  loading: candidatesLoading,
  error: candidatesError,
  load: loadCandidates,
} = useOrganizationMonitors(candidatesScope)
const options = computed(() =>
  monitors.value
    .filter((m) => !probe.value?.monitors.some((bound) => bound.id === m.id))
    .map((m) => ({ value: m.id, label: `${m.projectName} · ${m.name}` })),
)
let generation = 0
let controller: AbortController | undefined
async function load() {
  const token = ++generation
  const context = accessContext()
  controller?.abort()
  controller = new AbortController()
  probe.value = undefined
  error.value = ''
  loading.value = false
  if (!scope.value || !props.probeId) return
  loading.value = true
  try {
    const result = await getProbe(props.orgId, props.probeId, { signal: controller.signal })
    if (token === generation && isCurrentContext(context) && scope.value)
      probe.value = withoutProbeSecret(result)
  } catch (cause) {
    if (token === generation && isCurrentContext(context))
      error.value = cause instanceof Error ? cause.message : t('probePage.bindingsFailed')
  } finally {
    if (token === generation) loading.value = false
  }
}
watch(
  visible,
  (open) => {
    tab.value = 'monitors'
    binding.value = false
    removing.value = undefined
    selected.value = []
    bindError.value = ''
    if (!open) {
      generation++
      controller?.abort()
      probe.value = undefined
    } else void load()
  },
  { flush: 'sync' },
)
watch(
  () => [props.orgId, props.probeId, permissionEpoch.value, sessionEpoch.value],
  () => {
    visible.value = false
    probe.value = undefined
  },
  { flush: 'sync' },
)
watch(tab, () => {
  binding.value = false
  selected.value = []
  removing.value = undefined
})
async function bind() {
  const ids = [...new Set(selected.value)]
  if (
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !options.value.some((option) => option.value === id))
  ) {
    bindError.value = t('probePage.bindRequired')
    return
  }
  const result = await run('bind', (orgId) => bindProbeMonitors(orgId, props.probeId, ids))
  if (!result) return
  probe.value = withoutProbeSecret(result)
  selected.value = []
  binding.value = false
  bindError.value = ''
  MessagePlugin.success(t('probePage.boundDone'))
  emit('changed')
}
async function unbind() {
  const id = removing.value
  if (!id) return
  const result = await run('unbind', (orgId) => unbindProbeMonitor(orgId, props.probeId, id))
  if (!result) return
  probe.value = withoutProbeSecret(result)
  removing.value = undefined
  MessagePlugin.success(t('probePage.unboundDone'))
  emit('changed')
}
function cancelRemove(open: boolean) {
  if (!open) removing.value = undefined
}
const removeName = computed(
  () => probe.value?.monitors.find((m) => m.id === removing.value)?.name ?? '',
)
onScopeDispose(() => {
  generation++
  controller?.abort()
})
</script>

<template>
  <t-drawer v-model:visible="visible" size="min(760px, 100vw)" :footer="false" destroy-on-close>
    <template #header
      ><span class="probe-detail__title">{{ probe?.name || t('probePage.detail') }}</span></template
    >
    <div class="probe-detail">
      <div class="probe-detail__toolbar">
        <t-radio-group v-model="tab" variant="outline" size="small">
          <t-radio-button
            v-for="value in ['monitors', 'results', 'executions']"
            :key="value"
            :value="value"
            >{{ t(`probePage.${value}`) }}</t-radio-button
          >
        </t-radio-group>
        <t-tooltip :content="t('probePage.refresh')"
          ><t-button
            shape="square"
            variant="outline"
            :loading="loading"
            :aria-label="t('probePage.refresh')"
            @click="load"
            ><AppIcon :icon="RefreshIcon" /></t-button
        ></t-tooltip>
      </div>
      <t-alert v-if="error || actionError" theme="error" :message="error || actionError" />
      <div v-if="loading" class="probe-detail__state">
        <t-loading :text="t('common.loading')" />
      </div>
      <template v-else-if="probe">
        <template v-if="tab === 'monitors'">
          <dl class="probe-detail__info">
            <div>
              <dt>{{ t('probePage.id') }}</dt>
              <dd>{{ probe.id }}</dd>
            </div>
            <div>
              <dt>{{ t('probePage.status') }}</dt>
              <dd>
                {{
                  t(
                    !probe.enabled
                      ? 'probePage.disabled'
                      : probe.status === 'ONLINE'
                        ? 'probePage.online'
                        : 'probePage.offline',
                  )
                }}
              </dd>
            </div>
            <div>
              <dt>{{ t('probePage.region') }}</dt>
              <dd>{{ probe.region }}</dd>
            </div>
            <div>
              <dt>{{ t('probePage.callbackUrl') }}</dt>
              <dd>{{ probe.callbackUrl }}</dd>
            </div>
            <div>
              <dt>{{ t('probePage.heartbeat') }}</dt>
              <dd>
                {{
                  probe.lastHeartbeat ? formatDateTime(probe.lastHeartbeat) : t('probePage.never')
                }}
              </dd>
            </div>
            <div>
              <dt>{{ t('probePage.heartbeatInterval') }}</dt>
              <dd>{{ probe.heartbeatIntervalSeconds ?? '-' }}</dd>
            </div>
          </dl>
          <div class="probe-detail__toolbar">
            <h3>{{ t('probePage.monitors') }} ({{ probe.monitors.length }})</h3>
            <t-button :disabled="!!busy" variant="outline" @click="binding = !binding">
              <template #icon><AppIcon :icon="PlusSignIcon" /></template>{{ t('probePage.bind') }}
            </t-button>
          </div>
          <div v-if="binding" class="probe-detail__binding">
            <t-alert
              v-if="candidatesError || bindError"
              theme="error"
              :message="candidatesError || bindError"
            />
            <t-select
              v-model="selected"
              multiple
              filterable
              clearable
              :loading="candidatesLoading"
              :options="options"
              :placeholder="t('probePage.bindPlaceholder')"
              :aria-label="t('probePage.bindPlaceholder')"
            />
            <t-button
              :loading="busy === 'bind'"
              :disabled="candidatesLoading || !!candidatesError"
              @click="bind"
            >
              <template #icon><AppIcon :icon="LinkSquare02Icon" /></template
              >{{ t('probePage.bind') }}
            </t-button>
            <t-button v-if="candidatesError" variant="outline" @click="loadCandidates">{{
              t('probePage.retry')
            }}</t-button>
          </div>
          <p v-if="!probe.monitors.length" class="probe-detail__state">
            {{ t('probePage.noBindings') }}
          </p>
          <article
            v-for="monitor in probe.monitors"
            :key="monitor.id"
            class="probe-detail__monitor"
          >
            <div>
              <strong>{{ monitor.name }}</strong
              ><small>{{ monitor.type }} · {{ monitor.target }}</small>
            </div>
            <t-tooltip :content="t('probePage.unbind')"
              ><t-button
                variant="text"
                shape="square"
                :disabled="!!busy"
                :aria-label="t('probePage.unbind')"
                @click="removing = monitor.id"
                ><AppIcon :icon="Delete02Icon" /></t-button
            ></t-tooltip>
          </article>
        </template>
        <ProbeHistory
          v-else
          :key="tab"
          :org-id="orgId"
          :probe-id="probeId"
          :kind="tab === 'results' ? 'results' : 'executions'"
        />
      </template>
    </div>
    <t-dialog
      :visible="!!removing"
      :header="t('probePage.unbind')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('common.confirm'), loading: !!busy }"
      :cancel-btn="t('common.cancel')"
      @update:visible="cancelRemove"
      @confirm="unbind"
    >
      {{ t('probePage.unbindConfirm', { name: removeName }) }}
    </t-dialog>
  </t-drawer>
</template>

<style scoped lang="less">
.probe-detail {
  min-width: 0;
  display: grid;
  gap: 16px;
  &__title {
    overflow-wrap: anywhere;
  }
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    font-size: 14px;
  }
  &__info {
    margin: 0;
    display: grid;
    gap: 10px;
    padding-bottom: 16px;
    border-bottom: 1px solid @beacon-border;
  }
  &__info > div {
    display: grid;
    grid-template-columns: minmax(100px, 160px) minmax(0, 1fr);
    gap: 12px;
  }
  dt {
    color: @beacon-text-secondary;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  &__state {
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: @beacon-text-secondary;
  }
  &__binding {
    display: grid;
    gap: 8px;
  }
  &__binding > button {
    justify-self: end;
  }
  &__monitor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;
  }
  strong,
  small {
    display: block;
    overflow-wrap: anywhere;
  }
  small {
    margin-top: 6px;
    color: @beacon-text-secondary;
  }
  @media (max-width: 600px) {
    &__info > div {
      grid-template-columns: minmax(90px, 120px) minmax(0, 1fr);
    }
  }
}
</style>
