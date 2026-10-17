<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { NotificationReadFilter, UserNotification } from '@/api/types/notification-center'
import AppIcon from '@/components/AppIcon.vue'
import NotificationItem from '@/components/notifications/NotificationItem.vue'
import { RefreshIcon } from '@/icons'
import { useNotificationStore, useUserStore } from '@/stores'
import { resolveNotificationTarget } from '@/utils/notification-presenter'

/**
 * 顶栏「N 个事项」入口：从右侧滑出，只放最近的几条，
 * 更多内容去通知列表页（底部「查看全部事项」）。
 */
defineOptions({ name: 'NotificationDrawer' })

const { t } = useI18n()
const router = useRouter()
const store = useNotificationStore()
const userStore = useUserStore()

/** 正在提交动作的条目，避免重复点击 */
const pendingId = ref('')

const visible = computed({
  get: () => store.drawerVisible,
  set: (value: boolean) => {
    if (!value) store.closeDrawer()
  },
})

const filter = computed({
  get: () => store.filter,
  set: (value: NotificationReadFilter) => store.setFilter(value),
})

const FILTERS: NotificationReadFilter[] = ['all', 'unread', 'read']

/** 筛选下拉：已加载过的筛选带上计数，如「全部 (12)」 */
const filterOptions = computed(() =>
  FILTERS.map((value) => {
    const count = store.counts[value]
    const label = t(`notificationCenter.filter.${value}`)
    return { value, label: count == null ? label : `${label} (${count})` }
  }),
)

const heading = computed(() =>
  store.hasUnread
    ? t('notificationCenter.title', { count: store.unreadCount })
    : t('notificationCenter.titleEmpty'),
)

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

function onRead(id: string) {
  void run(id, () => store.markAsRead(id))
}

async function onIgnore(id: string) {
  await run(id, async () => {
    await store.remove(id)
    MessagePlugin.success(t('notificationCenter.ignoreDone'))
  })
}

/** Open the authorized workspace destination and close the drawer. */
async function onHandle(notification: UserNotification) {
  const target = resolveNotificationTarget(notification, {
    isSuperAdmin: userStore.isSuperAdmin,
  })
  if (!target) return
  await run(notification.id, async () => {
    try {
      await store.prepareNotificationTarget(notification)
      if (!notification.isRead) await store.markAsRead(notification.id)
      store.closeDrawer()
      await router.push(target.to)
    } catch {
      MessagePlugin.error(t('notificationCenter.targetUnavailable'))
    }
  })
}

function goList() {
  store.closeDrawer()
  void router.push('/notifications')
}
</script>

<template>
  <t-drawer v-model:visible="visible" size="min(600px, 100vw)" :footer="false">
    <template #header>
      <span class="notification-drawer__heading">{{ heading }}</span>
    </template>

    <div class="notification-drawer">
      <div class="notification-drawer__filters">
        <t-select
          v-model="filter"
          class="notification-drawer__select"
          :options="filterOptions"
          :aria-label="t('notificationCenter.filter.all')"
        />
        <t-tooltip :content="t('notificationCenter.refresh')">
          <t-button
            variant="outline"
            shape="square"
            :loading="store.loading"
            :aria-label="t('notificationCenter.refresh')"
            @click="store.refresh"
          >
            <template #icon><AppIcon :icon="RefreshIcon" /></template>
          </t-button>
        </t-tooltip>
      </div>

      <div v-if="store.error" class="notification-drawer__state">
        <t-alert theme="error" :message="store.error" />
        <t-button variant="outline" @click="store.refresh">
          {{ t('notificationCenter.retry') }}
        </t-button>
      </div>

      <div v-else-if="store.loading && !store.recent.length" class="notification-drawer__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="store.recent.length">
        <div class="notification-drawer__list">
          <NotificationItem
            v-for="item in store.recent"
            :key="item.id"
            :notification="item"
            :pending="pendingId === item.id"
            @read="onRead"
            @ignore="onIgnore"
            @handle="onHandle"
          />
        </div>

        <t-button class="notification-drawer__more" variant="text" block @click="goList">
          {{ t('notificationCenter.more') }}
        </t-button>
      </template>

      <p v-else class="notification-drawer__empty">
        {{
          store.loaded && store.filter !== 'all'
            ? t('notificationCenter.noMatches')
            : t('notificationCenter.empty')
        }}
      </p>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.notification-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__heading {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__select {
    width: 240px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__more {
    margin-top: 4px;
  }

  &__empty {
    padding: 48px 0;
    margin: 0;
    color: @beacon-text-tertiary;
    text-align: center;
  }
}
</style>
