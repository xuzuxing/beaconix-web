<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { listUserNotifications } from '@/api'
import type { NotificationReadFilter, UserNotification } from '@/api/types/notification-center'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import NotificationItem from '@/components/notifications/NotificationItem.vue'
import PendingInvitations from '@/components/notifications/PendingInvitations.vue'
import { RefreshIcon } from '@/icons'
import { useNotificationStore } from '@/stores'
import { notificationReadParam, resolveNotificationTarget } from '@/utils/notification-presenter'

/**
 * 消息通知 → 事项列表。
 * 顶栏抽屉只放最近几条，这里是完整列表：按已读状态筛选 + 分页，条目进详情页。
 */
defineOptions({ name: 'NotificationListView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useNotificationStore()

const FILTERS: NotificationReadFilter[] = ['all', 'unread', 'read']
const PAGE_SIZES = [10, 20, 50]

const items = ref<UserNotification[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const pendingId = ref('')
let generation = 0
let active = true

const queryValue = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''

function setQuery(patch: Record<string, string | undefined>) {
  void router.replace({ query: { ...route.query, ...patch } })
}

/** 筛选与分页都同步到 URL，便于刷新与分享 */
const filter = computed<NotificationReadFilter>({
  get: () => {
    const value = queryValue('status') as NotificationReadFilter
    return FILTERS.includes(value) ? value : 'all'
  },
  set: (value) => setQuery({ status: value === 'all' ? undefined : value, page: undefined }),
})

const pageSize = computed(() =>
  PAGE_SIZES.includes(Number(queryValue('size'))) ? Number(queryValue('size')) : 20,
)

const page = computed(() => Math.max(1, Math.floor(Number(queryValue('page'))) || 1))

const filterOptions = computed(() =>
  FILTERS.map((value) => {
    const count = store.counts[value]
    const label = t(`notificationCenter.filter.${value}`)
    return { value, label: count == null ? label : `${label} (${count})` }
  }),
)

async function load() {
  if (!active) return
  const token = ++generation
  loading.value = true
  error.value = ''
  try {
    const isRead = notificationReadParam(filter.value)
    const result = await listUserNotifications({
      page: page.value,
      limit: pageSize.value,
      ...(isRead === undefined ? {} : { isRead }),
    })
    if (token !== generation) return
    const data = result?.data ?? []
    items.value = store.reconcileNotifications(data, filter.value)
    total.value = Math.max(
      0,
      (result?.meta?.total ?? data.length) - (data.length - items.value.length),
    )
  } catch (cause) {
    if (token !== generation) return
    error.value = cause instanceof Error ? cause.message : t('notificationCenter.loadFailed')
    items.value = []
    total.value = 0
  } finally {
    if (token === generation) loading.value = false
  }
}

async function run(id: string, action: () => Promise<unknown>) {
  if (pendingId.value) return
  pendingId.value = id
  try {
    await action()
  } catch {
    // 请求层已统一提示
  } finally {
    pendingId.value = ''
  }
}

/** 详情页/标题链接进入即已读，这里按条目当时的未读状态校正角标 */
function onRead(id: string) {
  const item = items.value.find((entry) => entry.id === id)
  const wasUnread = item ? !item.isRead : true
  void run(id, async () => {
    await store.markAsRead(id, wasUnread)
    if (item) {
      item.isRead = true
      item.readAt = new Date().toISOString()
    }
  })
}

function onIgnore(id: string) {
  const item = items.value.find((entry) => entry.id === id)
  const wasUnread = item ? !item.isRead : true
  void run(id, async () => {
    await store.remove(id, wasUnread)
    MessagePlugin.success(t('notificationCenter.ignoreDone'))
    await load()
  })
}

async function onHandle(notification: UserNotification) {
  const target = resolveNotificationTarget(notification)
  if (!target) return
  await run(notification.id, async () => {
    try {
      await store.prepareNotificationTarget(notification)
      if (!notification.isRead) {
        await store.markAsRead(notification.id)
        notification.isRead = true
      }
      await router.push(target.to)
    } catch {
      MessagePlugin.error(t('notificationCenter.targetUnavailable'))
    }
  })
}

async function refresh() {
  await Promise.all([load(), store.refresh(), store.loadPendingInvitations()])
}
async function markAll() {
  try {
    await store.markAllAsRead()
    MessagePlugin.success(t('notificationCenter.markAllReadDone'))
    await load()
  } catch {
    // 请求层已统一提示
  }
}

function paginate(info: { current: number; pageSize: number }) {
  setQuery({ page: String(info.current), size: String(info.pageSize) })
}

watch([filter, page, pageSize], () => {
  if (active) void load()
})
watch(
  () => store.revision,
  () => {
    if (active) void load()
  },
)

onActivated(() => {
  if (active) return
  active = true
  void refresh()
})
function deactivate() {
  active = false
  generation++
  loading.value = false
  items.value = []
  total.value = 0
}
onDeactivated(deactivate)
onBeforeUnmount(deactivate)
onMounted(() => {
  void load()
  void store.refreshUnreadCount()
})
</script>

<template>
  <section class="notice-page">
    <HeaderActions>
      <t-tooltip :content="t('notificationCenter.refresh')"
        ><t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :aria-label="t('notificationCenter.refresh')"
          @click="refresh"
          ><template #icon><AppIcon :icon="RefreshIcon" /></template></t-button
      ></t-tooltip>
      <t-button :disabled="!store.hasUnread" @click="markAll">
        {{ t('notificationCenter.markAllRead') }}
      </t-button>
    </HeaderActions>

    <t-card class="notice-page__panel">
      <PendingInvitations />
      <p class="notice-page__scope">{{ t('notificationCenter.listScope') }}</p>

      <div class="notice-page__filters">
        <t-select
          v-model="filter"
          class="notice-page__filter"
          :options="filterOptions"
          :aria-label="t('notificationCenter.filter.all')"
        />
        <span class="notice-page__total">
          {{ t('notificationCenter.listTotal', { count: total }) }}
        </span>
      </div>

      <div v-if="error" class="notice-page__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('notificationCenter.retry') }}</t-button>
      </div>

      <div v-else-if="loading && !items.length" class="notice-page__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="items.length">
        <div class="notice-page__list">
          <NotificationItem
            v-for="item in items"
            :key="item.id"
            :notification="item"
            :pending="pendingId === item.id"
            with-time
            :link-to="{ name: 'notification-detail', params: { id: item.id } }"
            @read="onRead"
            @ignore="onIgnore"
            @handle="onHandle"
          />
        </div>

        <t-pagination
          :total="total"
          :current="page"
          :page-size="pageSize"
          :page-size-options="PAGE_SIZES"
          :show-jumper="false"
          @change="paginate"
        />
      </template>

      <div v-else class="notice-page__state">
        <p class="notice-page__empty">
          {{ filter === 'all' ? t('notificationCenter.empty') : t('notificationCenter.noMatches') }}
        </p>
        <t-button
          v-if="filter !== 'all'"
          variant="outline"
          @click="setQuery({ status: undefined, page: undefined })"
        >
          {{ t('notificationCenter.reset') }}
        </t-button>
      </div>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.notice-page {
  &__scope {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__filter {
    width: 200px;
  }

  &__total {
    margin-left: auto;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 0;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  :deep(.t-pagination) {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
