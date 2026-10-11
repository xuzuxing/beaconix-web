<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { listNotificationChannelLogs } from '@/api'
import type {
  NotificationChannel,
  NotificationLog,
  NotificationLogStatus,
} from '@/api/types/notification'
import AppIcon from '@/components/AppIcon.vue'
import ChannelLogItem from '@/components/channels/ChannelLogItem.vue'
import ChannelTypeTag from '@/components/channels/ChannelTypeTag.vue'
import { RefreshIcon } from '@/icons'

/** 渠道投递日志抽屉：按结果筛选 + 分页，条目可展开查看原始返回 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; channel?: NotificationChannel }>()
const { t } = useI18n()

const logs = ref<NotificationLog[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const status = ref<NotificationLogStatus | 'all'>('all')
let generation = 0
/** 打开抽屉时的重置赋值不应触发二次加载 */
let resetting = false

const statusOptions = computed(() => [
  { label: t('channelPage.allStatuses'), value: 'all' },
  { label: t('channelPage.delivery.SUCCESS'), value: 'SUCCESS' },
  { label: t('channelPage.delivery.FAILED'), value: 'FAILED' },
])

async function load() {
  const token = ++generation
  const channelId = props.channel?.id
  if (!props.orgId || !channelId) {
    logs.value = []
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await listNotificationChannelLogs(props.orgId, channelId, {
      page: page.value,
      limit: pageSize.value,
      ...(status.value === 'all' ? {} : { status: status.value }),
    })
    if (token !== generation) return
    logs.value = result.data
    total.value = result.meta?.total ?? result.data.length
  } catch (cause) {
    if (token === generation) {
      error.value = cause instanceof Error ? cause.message : t('channelPage.logsFailed')
      logs.value = []
      total.value = 0
    }
  } finally {
    if (token === generation) loading.value = false
  }
}

watch(
  visible,
  (value) => {
    generation++
    if (!value) return
    resetting = true
    page.value = 1
    status.value = 'all'
    resetting = false
    void load()
  },
  { flush: 'sync' },
)
watch([status, page], () => {
  if (!visible.value || resetting) return
  void load()
})
watch(
  () => props.channel?.id,
  () => {
    if (visible.value) void load()
  },
)
function paginate(info: { current: number }) {
  page.value = info.current
}
</script>

<template>
  <t-drawer v-model:visible="visible" size="520px" :footer="false">
    <template #header>
      <div class="channel-logs__head">
        <span class="channel-logs__title">{{ t('channelPage.logsTitle') }}</span>
        <ChannelTypeTag v-if="channel" :type="channel.type" />
        <span class="channel-logs__name">{{ channel?.name }}</span>
      </div>
    </template>
    <div class="channel-logs">
      <div class="channel-logs__filters">
        <t-radio-group v-model="status" variant="default-filled" size="small">
          <t-radio-button v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </t-radio-button>
        </t-radio-group>
        <t-tooltip :content="t('channelPage.refresh')"
          ><t-button
            variant="outline"
            shape="square"
            size="small"
            :loading="loading"
            :aria-label="t('channelPage.refresh')"
            @click="load"
            ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
        ></t-tooltip>
      </div>

      <div v-if="error" class="channel-logs__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('channelPage.retry') }}</t-button>
      </div>
      <div v-else-if="loading && !logs.length" class="channel-logs__state">
        <t-loading :text="t('common.loading')" />
      </div>
      <template v-else-if="logs.length">
        <ChannelLogItem
          v-for="(log, index) in logs"
          :key="`${log.id ?? 'log'}-${index}`"
          :log="log"
        />
        <t-pagination
          :total="total"
          :current="page"
          :page-size="pageSize"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <p v-else class="channel-logs__empty">{{ t('channelPage.logsEmpty') }}</p>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.channel-logs {
  display: flex;
  flex-direction: column;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__name {
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-height: 200px;
    justify-content: center;
  }

  &__empty {
    padding: 48px 0;
    margin: 0;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
