<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { NotificationChannel, NotificationChannelType } from '@/api/types/notification'
import AppIcon from '@/components/AppIcon.vue'
import ChannelActions from '@/components/channels/ChannelActions.vue'
import ChannelEditorDialog from '@/components/channels/ChannelEditorDialog.vue'
import ChannelLogsDrawer from '@/components/channels/ChannelLogsDrawer.vue'
import ChannelStatusTag from '@/components/channels/ChannelStatusTag.vue'
import ChannelTypeTag from '@/components/channels/ChannelTypeTag.vue'
import { useChannelActions } from '@/composables/useChannelActions'
import { useChannelList } from '@/composables/useChannelList'
import { useOrganizationRole } from '@/composables/useOrganizationRole'
import { PlusSignIcon, RefreshIcon, Search01Icon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import {
  CHANNEL_TYPES,
  channelConfigSummary,
  maskWebhookUrl,
  selectChannels,
  type ChannelSort,
  type ChannelStatusFilter,
} from '@/utils/channel-presenter'

/**
 * 通知渠道 → 渠道管理。
 * 渠道是组织级资源：列表按当前团队加载，配置按类型切换，投递日志在抽屉中查看。
 */
defineOptions({ name: 'ChannelsView' })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)
const { canManage } = useOrganizationRole()
const { channels, loading, error, load } = useChannelList(orgId)
const { pending, actionError, act } = useChannelActions(orgId, async () => {
  await load()
})

const editor = ref(false)
const editing = ref<NotificationChannel>()
const logsDrawer = ref(false)
const logsChannel = ref<NotificationChannel>()

const statusFilters: ChannelStatusFilter[] = ['all', 'enabled', 'disabled']
const sorts: ChannelSort[] = ['newest', 'name', 'type']
const queryValue = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
function setFilter(key: string, value: string | number) {
  void router.replace({
    query: {
      ...route.query,
      [key]: value === 'all' || value === '' ? undefined : String(value),
      page: undefined,
    },
  })
}
const search = computed({ get: () => queryValue('q'), set: (value) => setFilter('q', value) })
const type = computed({
  get: () =>
    CHANNEL_TYPES.includes(queryValue('type') as NotificationChannelType)
      ? (queryValue('type') as NotificationChannelType)
      : ('all' as const),
  set: (value) => setFilter('type', value),
})
const status = computed({
  get: () =>
    statusFilters.includes(queryValue('status') as ChannelStatusFilter)
      ? (queryValue('status') as ChannelStatusFilter)
      : ('all' as const),
  set: (value) => setFilter('status', value),
})
const sort = computed({
  get: () =>
    sorts.includes(queryValue('sort') as ChannelSort)
      ? (queryValue('sort') as ChannelSort)
      : 'newest',
  set: (value) => setFilter('sort', value),
})
const pageSize = computed(() =>
  [10, 20, 50].includes(Number(queryValue('size'))) ? Number(queryValue('size')) : 10,
)
const filtered = computed(() =>
  selectChannels(channels.value, search.value, type.value, status.value, sort.value),
)
const page = computed(() =>
  Math.min(
    Math.max(1, Math.floor(Number(queryValue('page'))) || 1),
    Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
  ),
)
const rows = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

// 切换团队时关闭编辑/日志浮层；列表本身由 useChannelList 负责重载
watch(
  orgId,
  () => {
    editor.value = false
    logsDrawer.value = false
  },
  { flush: 'sync' },
)

function edit(channel?: NotificationChannel) {
  editing.value = channel
  editor.value = true
}
function openLogs(channel: NotificationChannel) {
  logsChannel.value = channel
  logsDrawer.value = true
}
/** webhook 类地址展示时隐藏 query 里的签名参数 */
function summary(channel: NotificationChannel) {
  const summary = channelConfigSummary(channel)
  return summary.startsWith('http') ? maskWebhookUrl(summary) : summary
}
function paginate({ current, pageSize: size }: { current: number; pageSize: number }) {
  void router.replace({ query: { ...route.query, page: String(current), size: String(size) } })
}
</script>

<template>
  <section class="channel-page">
    <Teleport defer to="#layout-header-actions">
      <t-tooltip :content="t('channelPage.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!orgId"
          :aria-label="t('channelPage.refresh')"
          @click="load"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button v-if="canManage" :disabled="!orgId" @click="edit()"
        ><template #icon><AppIcon :icon="PlusSignIcon" /></template
        >{{ t('channelPage.create') }}</t-button
      >
    </Teleport>

    <t-card class="channel-page__panel">
      <template #title>{{ t('channelPage.manageTitle') }}</template>
      <template #actions>
        <span class="channel-page__scope">{{ org.currentOrganization?.name ?? '-' }}</span>
      </template>

      <t-alert v-if="actionError" theme="error" :message="actionError" />
      <div class="channel-page__filters">
        <t-input
          v-model="search"
          clearable
          :placeholder="t('channelPage.search')"
          :aria-label="t('channelPage.search')"
          ><template #prefix-icon><AppIcon :icon="Search01Icon" /></template
        ></t-input>
        <t-select
          v-model="type"
          :aria-label="t('channelPage.allTypes')"
          :options="[
            { label: t('channelPage.allTypes'), value: 'all' },
            ...CHANNEL_TYPES.map((value) => ({ label: t(`channelPage.type.${value}`), value })),
          ]"
        />
        <t-select
          v-model="status"
          :aria-label="t('channelPage.allStatuses')"
          :options="[
            { label: t('channelPage.allStatuses'), value: 'all' },
            { label: t('channelPage.enabled'), value: 'enabled' },
            { label: t('channelPage.disabled'), value: 'disabled' },
          ]"
        />
        <t-select
          v-model="sort"
          :aria-label="t('channelPage.sort')"
          :options="[
            { label: t('channelPage.sortNewest'), value: 'newest' },
            { label: t('channelPage.sortName'), value: 'name' },
            { label: t('channelPage.sortType'), value: 'type' },
          ]"
        />
      </div>

      <div v-if="error" class="channel-page__empty">
        <t-alert theme="error" :message="error" />
        <t-button @click="load">{{ t('channelPage.retry') }}</t-button>
      </div>
      <div v-else-if="loading" class="channel-page__empty">
        <t-loading :text="t('common.loading')" />
      </div>
      <div v-else-if="!orgId" class="channel-page__empty">
        {{ t('channelPage.noOrganization') }}
      </div>
      <template v-else-if="rows.length">
        <div class="channel-page__table">
          <div class="channel-page__table-head">
            <span>{{ t('channelPage.name') }}</span
            ><span>{{ t('channelPage.typeLabel') }}</span
            ><span>{{ t('channelPage.statusLabel') }}</span
            ><span>{{ t('channelPage.actions') }}</span>
          </div>
          <article v-for="channel in rows" :key="channel.id" class="channel-row">
            <div class="channel-row__identity">
              <div class="channel-row__name">
                <span>{{ channel.name }}</span>
              </div>
              <p class="channel-row__summary" :title="summary(channel)">{{ summary(channel) }}</p>
            </div>
            <ChannelTypeTag :type="channel.type" />
            <ChannelStatusTag :enabled="channel.enabled" />
            <ChannelActions
              :channel="channel"
              :pending="pending[channel.id]"
              :can-manage="canManage"
              @edit="edit(channel)"
              @logs="openLogs(channel)"
              @action="act(orgId, channel, $event)"
            />
          </article>
        </div>
        <t-pagination
          :total="filtered.length"
          :current="page"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :show-jumper="false"
          @change="paginate"
        />
      </template>
      <div v-else class="channel-page__empty">
        <p>{{ t(channels.length ? 'channelPage.noMatches' : 'channelPage.empty') }}</p>
        <t-button v-if="channels.length" variant="outline" @click="router.replace({ query: {} })">{{
          t('channelPage.reset')
        }}</t-button>
        <t-button v-else-if="canManage" @click="edit()">{{ t('channelPage.create') }}</t-button>
      </div>
    </t-card>

    <ChannelEditorDialog v-model:visible="editor" :org-id="orgId" :channel="editing" />
    <ChannelLogsDrawer v-model:visible="logsDrawer" :org-id="orgId" :channel="logsChannel" />
  </section>
</template>

<style scoped lang="less">
.channel-page {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__filters {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 150px 130px 150px;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__table {
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  .channel-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 130px 90px 176px;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: 240px;
    justify-content: center;
  }

  :deep(.t-pagination) {
    padding-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
}

.channel-row {
  &__identity {
    min-width: 0;
  }

  &__name {
    color: @beacon-text-primary;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 6px 0 0;
    font-size: 12px;
    color: @beacon-text-secondary;
  }
}

@media (max-width: 1200px) {
  .channel-page__table-head,
  .channel-page .channel-row {
    grid-template-columns: minmax(150px, 1fr) 120px 90px;
  }
  .channel-page__table-head > :nth-child(3),
  .channel-row > :nth-child(3) {
    display: none;
  }
}

@media (max-width: 600px) {
  .channel-page__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    > :first-child {
      grid-column: 1 / -1;
    }
  }
  .channel-page__table-head {
    display: none;
  }
  .channel-page .channel-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 16px 8px;
  }
  .channel-row__identity {
    grid-column: 1 / -1;
  }
  .channel-row > :nth-child(3) {
    display: inline-flex;
  }
}
</style>
