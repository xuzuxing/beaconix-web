<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'

import type { UserNotification } from '@/api/types/notification-center'
import AppIcon from '@/components/AppIcon.vue'
import InvitationActions from './InvitationActions.vue'
import { notificationIcon } from './notification-icons'
import { LinkSquare02Icon } from '@/icons'
import {
  formatNotificationTime,
  notificationBodyText,
  notificationLabelKey,
  notificationMetaRows,
  notificationTheme,
  resolveNotificationTarget,
} from '@/utils/notification-presenter'

/**
 * 单条事项卡片：左侧类型色条 + 标签 / 标题 / 时间 + 正文 + 操作区。
 * 只负责展示与向父级抛出动作，已读、忽略、跳转都由调用方决定。
 */
defineOptions({ name: 'NotificationItem' })

const props = defineProps<{
  notification: UserNotification
  /** 该条正在提交动作，按钮禁用 */
  pending?: boolean
  /** 时间是否精确到分（列表页与详情页用） */
  withTime?: boolean
  /** 提供时标题渲染成跳转链接，列表页用它进详情页 */
  linkTo?: RouteLocationRaw
  dismissible?: boolean
}>()

const emit = defineEmits<{
  read: [id: string]
  ignore: [id: string]
  handle: [notification: UserNotification]
}>()

const { t } = useI18n()

/** 展开状态：展开同时把未读标记已读 */
const expanded = ref(false)

const theme = computed(() => notificationTheme(props.notification.type))
const labelKey = computed(() => notificationLabelKey(props.notification.type))
const text = computed(() => notificationBodyText(props.notification.body))
const time = computed(() => formatNotificationTime(props.notification.createdAt, props.withTime))
const target = computed(() => resolveNotificationTarget(props.notification))
const icon = computed(() => notificationIcon(props.notification.type))

/** 展开区里的附加信息：meta 的键值对，值统一转成可读文本 */
const metaRows = computed(() => {
  return notificationMetaRows(props.notification.meta)
})

const resourceText = computed(() => {
  const { resourceType, resourceId } = props.notification
  if (!resourceType) return ''
  return resourceId ? `${resourceType} · ${resourceId}` : resourceType
})

function toggleDetail() {
  expanded.value = !expanded.value
  if (expanded.value && !props.notification.isRead) {
    emit('read', props.notification.id)
  }
}

function handle() {
  emit('handle', props.notification)
}
</script>

<template>
  <article class="notice" :class="[`notice--${theme}`, { 'notice--unread': !notification.isRead }]">
    <span class="notice__bar" aria-hidden="true" />

    <div class="notice__main">
      <div class="notice__head">
        <t-tag class="notice__tag" :theme="theme" variant="light" size="small">
          <AppIcon :icon="icon" :size="12" />
          {{ t(labelKey) }}
        </t-tag>
        <RouterLink
          v-if="linkTo"
          class="notice__title notice__title--link"
          :to="linkTo"
          :title="notification.title"
          @click="emit('read', notification.id)"
        >
          {{ notification.title }}
        </RouterLink>
        <span v-else class="notice__title" :title="notification.title">{{
          notification.title
        }}</span>
        <span
          v-if="!notification.isRead"
          class="notice__dot"
          :title="t('notificationCenter.statusUnread')"
        />
        <time class="notice__time">{{ time }}</time>
      </div>

      <div class="notice__content">
        <p class="notice__text" :class="{ 'notice__text--full': expanded }">{{ text }}</p>

        <div class="notice__actions">
          <t-button
            v-if="dismissible !== false"
            variant="text"
            size="small"
            :disabled="pending"
            @click="emit('ignore', notification.id)"
          >
            {{ t('notificationCenter.ignore') }}
          </t-button>
          <t-button
            variant="text"
            size="small"
            theme="primary"
            :disabled="pending"
            @click="toggleDetail"
          >
            {{ expanded ? t('notificationCenter.collapse') : t('notificationCenter.detail') }}
            <AppIcon
              v-if="!expanded"
              class="notice__action-icon"
              :icon="LinkSquare02Icon"
              :size="12"
            />
          </t-button>
          <t-button
            v-if="target"
            variant="text"
            size="small"
            theme="primary"
            :disabled="pending"
            @click="handle"
          >
            {{ t('notificationCenter.handle') }}
          </t-button>
        </div>
      </div>

      <InvitationActions :notification="notification" :disabled="pending" />

      <!-- 展开区：完整正文 + 关联资源 / 时间 / 附加信息 -->
      <dl v-if="expanded" class="notice__detail">
        <div v-if="text" class="notice__detail-row">
          <dt>{{ t('notificationCenter.content') }}</dt>
          <dd class="notice__detail-text">{{ text }}</dd>
        </div>
        <div v-if="resourceText" class="notice__detail-row">
          <dt>{{ t('notificationCenter.resource') }}</dt>
          <dd>{{ resourceText }}</dd>
        </div>
        <div class="notice__detail-row">
          <dt>{{ t('notificationCenter.createdAt') }}</dt>
          <dd>{{ formatNotificationTime(notification.createdAt, true) }}</dd>
        </div>
        <div v-if="notification.readAt" class="notice__detail-row">
          <dt>{{ t('notificationCenter.readAt') }}</dt>
          <dd>{{ formatNotificationTime(notification.readAt, true) }}</dd>
        </div>
        <div v-if="metaRows.length" class="notice__detail-row">
          <dt>{{ t('notificationCenter.meta') }}</dt>
          <dd>
            <span v-for="row in metaRows" :key="row.key" class="notice__meta">
              {{ row.key }}：{{ row.value }}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  </article>
</template>

<style scoped lang="less">
.notice {
  position: relative;
  display: flex;
  overflow: hidden;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &:hover {
    border-color: @beacon-brand-hover;
  }

  // 左侧类型色条：颜色跟随主题
  &__bar {
    flex: none;
    width: 4px;
    background-color: @beacon-border-strong;
  }

  &--primary &__bar {
    background-color: @beacon-brand;
  }

  &--success &__bar {
    background-color: @beacon-success;
  }

  &--warning &__bar {
    background-color: @beacon-warning;
  }

  &--danger &__bar {
    background-color: @beacon-error;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 12px 14px;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__tag {
    flex: none;
    :deep(.t-tag__text) {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  &__title {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--unread &__title {
    font-weight: @beacon-font-weight-medium;
  }

  &__title--link {
    cursor: pointer;

    &:hover {
      color: @beacon-brand;
      text-decoration: underline;
    }
  }

  // 未读小圆点
  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    background-color: @beacon-error;
    border-radius: 50%;
  }

  &__time {
    flex: none;
    margin-left: auto;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__content {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  &__text {
    display: -webkit-box;
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;

    &--full {
      display: block;
      overflow: visible;
      -webkit-line-clamp: unset;
    }
  }

  &__actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }

  &__action-icon {
    margin-left: 2px;
  }

  // ---------- 展开区 ----------
  &__detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    margin: 2px 0 0;
    background-color: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }

  &__detail-row {
    display: flex;
    gap: 12px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  &__detail-row dt {
    flex: none;
    width: 72px;
    color: @beacon-text-tertiary;
  }

  &__detail-row dd {
    min-width: 0;
    margin: 0;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__detail-text {
    white-space: pre-wrap;
  }

  &__meta {
    display: block;
    color: @beacon-text-secondary;
  }

  @media (max-width: 600px) {
    &__head {
      flex-wrap: wrap;
    }
    &__title {
      flex: 1 1 120px;
    }
    &__time {
      margin-left: 0;
    }
    &__content {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }
    &__actions {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
}
</style>
