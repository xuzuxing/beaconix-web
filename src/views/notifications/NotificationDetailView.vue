<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { UserNotification } from '@/api/types/notification-center'
import AppIcon from '@/components/AppIcon.vue'
import InvitationActions from '@/components/notifications/InvitationActions.vue'
import { notificationIcon } from '@/components/notifications/notification-icons'
import { usePageHeader } from '@/composables/usePageHeader'
import { LinkSquare02Icon } from '@/icons'
import { useNotificationStore, useUserStore } from '@/stores'
import {
  formatNotificationTime,
  notificationBodyText,
  notificationLabelKey,
  notificationMetaRows,
  notificationTheme,
  resolveNotificationTarget,
} from '@/utils/notification-presenter'

/** User-scoped detail lookup has no list pagination limit. */
defineOptions({ name: 'NotificationDetailView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useNotificationStore()
const userStore = useUserStore()

const notification = ref<UserNotification | null>(null)
const loading = ref(false)
const error = ref('')
const pending = ref(false)
let active = true
let generation = 0

const id = computed(() => String(route.params.id ?? ''))

usePageHeader({
  title: computed(
    () => notification.value?.title || t('notificationCenter.detailTitle'),
  ),
  back: '/notifications',
})

const theme = computed(() =>
  notification.value ? notificationTheme(notification.value.type) : 'default',
)
const labelKey = computed(() =>
  notification.value
    ? notificationLabelKey(notification.value.type)
    : 'notificationCenter.type.task',
)
const text = computed(() =>
  notification.value ? notificationBodyText(notification.value.body) : '',
)
const target = computed(() =>
  notification.value
    ? resolveNotificationTarget(notification.value, {
        isSuperAdmin: userStore.isSuperAdmin,
      })
    : null,
)
const icon = computed(() => notificationIcon(notification.value?.type ?? ''))

const metaRows = computed(() => {
  return notificationMetaRows(notification.value?.meta ?? null)
})

async function load() {
  if (!active) return
  const request = ++generation
  const lookupId = id.value
  notification.value = null
  if (!id.value) {
    notification.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    const hit = await store.loadNotification(lookupId)
    if (request !== generation) return
    notification.value = hit
    // 进入详情即视为已读
    if (hit && !hit.isRead) {
      await store.markAsRead(hit.id, true)
      hit.isRead = true
      hit.readAt = new Date().toISOString()
    }
  } catch (cause) {
    if (request !== generation) return
    error.value =
      cause instanceof Error
        ? cause.message
        : t('notificationCenter.loadFailed')
    notification.value = null
  } finally {
    if (request === generation) loading.value = false
  }
}

async function run(action: () => Promise<unknown>) {
  if (pending.value) return
  pending.value = true
  try {
    await action()
  } catch {
    // 请求层已统一提示
  } finally {
    pending.value = false
  }
}

function onRead() {
  const item = notification.value
  if (!item) return
  void run(async () => {
    await store.markAsRead(item.id, !item.isRead)
    item.isRead = true
    item.readAt = new Date().toISOString()
    MessagePlugin.success(t('notificationCenter.readDone'))
  })
}

function onIgnore() {
  const item = notification.value
  if (!item) return
  void run(async () => {
    await store.remove(item.id, !item.isRead)
    MessagePlugin.success(t('notificationCenter.ignoreDone'))
    await router.push('/notifications')
  })
}

async function onHandle() {
  const item = notification.value
  const to = target.value
  if (!item || !to) return
  await run(async () => {
    try {
      await store.prepareNotificationTarget(item)
      await router.push(to.to)
    } catch {
      MessagePlugin.error(t('notificationCenter.targetUnavailable'))
    }
  })
}

watch(id, () => {
  if (active) void load()
})
watch(
  () => store.revision,
  () => {
    if (active && notification.value)
      notification.value = store.reconcileNotification(notification.value)
  },
)

onActivated(() => {
  if (active) return
  active = true
  void load()
})
function deactivate() {
  active = false
  generation++
  loading.value = false
  notification.value = null
}
onDeactivated(deactivate)
onBeforeUnmount(deactivate)
void load()
</script>

<template>
  <section class="notice-detail">
    <div
      v-if="error"
      class="notice-detail__state"
    >
      <t-alert
        theme="error"
        :message="error"
      />
      <t-button
        variant="outline"
        @click="load"
        >{{ t('notificationCenter.retry') }}</t-button
      >
    </div>

    <div
      v-else-if="loading"
      class="notice-detail__state"
    >
      <t-loading :text="t('common.loading')" />
    </div>

    <t-card
      v-else-if="notification"
      :bordered="false"
    >
      <template #title>
        <div class="notice-detail__head">
          <AppIcon
            :icon="icon"
            :size="16"
          />
          <t-tag
            :theme="theme"
            variant="light"
            size="small"
            >{{ t(labelKey) }}</t-tag
          >
          <t-tag
            :theme="notification.isRead ? 'default' : 'danger'"
            variant="light"
            size="small"
          >
            {{
              notification.isRead
                ? t('notificationCenter.statusRead')
                : t('notificationCenter.statusUnread')
            }}
          </t-tag>
        </div>
      </template>

      <div class="notice-detail__body">
        <h3 class="notice-detail__title">{{ notification.title }}</h3>
        <p class="notice-detail__time">
          {{ formatNotificationTime(notification.createdAt, true) }}
        </p>

        <p
          v-if="text"
          class="notice-detail__text"
        >
          {{ text }}
        </p>

        <InvitationActions
          :notification="notification"
          :disabled="pending"
        />

        <t-descriptions
          :column="1"
          bordered
          class="notice-detail__fields"
        >
          <t-descriptions-item :label="t('notificationCenter.resource')">
            {{ notification.resourceType ?? '-' }}
          </t-descriptions-item>
          <t-descriptions-item :label="t('notificationCenter.resourceId')">
            {{ notification.resourceId ?? '-' }}
          </t-descriptions-item>
          <t-descriptions-item :label="t('notificationCenter.createdAt')">
            {{ formatNotificationTime(notification.createdAt, true) }}
          </t-descriptions-item>
          <t-descriptions-item :label="t('notificationCenter.readAt')">
            {{
              notification.readAt
                ? formatNotificationTime(notification.readAt, true)
                : '-'
            }}
          </t-descriptions-item>
          <t-descriptions-item
            v-if="metaRows.length"
            :label="t('notificationCenter.meta')"
          >
            <span
              v-for="row in metaRows"
              :key="row.key"
              class="notice-detail__meta"
            >
              {{ row.key }}：{{ row.value }}
            </span>
          </t-descriptions-item>
        </t-descriptions>

        <div class="notice-detail__actions">
          <t-button
            v-if="!notification.isRead"
            variant="outline"
            :loading="pending"
            @click="onRead"
          >
            {{ t('notificationCenter.readAction') }}
          </t-button>
          <t-button
            v-if="target"
            theme="primary"
            :loading="pending"
            @click="onHandle"
          >
            {{ t('notificationCenter.handle') }}
            <AppIcon
              class="notice-detail__action-icon"
              :icon="LinkSquare02Icon"
              :size="14"
            />
          </t-button>
          <t-button
            variant="outline"
            theme="danger"
            :loading="pending"
            @click="onIgnore"
          >
            {{ t('notificationCenter.ignore') }}
          </t-button>
        </div>
      </div>
    </t-card>

    <t-card
      v-else
      :bordered="false"
    >
      <div class="notice-detail__state">
        <p class="notice-detail__empty">
          {{ t('notificationCenter.notFound') }}
        </p>
        <t-button
          variant="outline"
          @click="router.push('/notifications')"
        >
          {{ t('notificationCenter.backToList') }}
        </t-button>
      </div>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.notice-detail {
  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__time {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__text {
    margin: 0;
    line-height: 22px;
    color: @beacon-text-secondary;
    white-space: pre-wrap;
  }

  &__fields {
    margin-top: 4px;
  }

  &__meta {
    display: block;
    overflow-wrap: anywhere;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  &__action-icon {
    margin-left: 4px;
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
}
</style>
