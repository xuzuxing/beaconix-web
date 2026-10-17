<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { TicketTimelineEntry } from '@/api/types/ticket'
import { formatDateTime } from '@/utils/billing'
import {
  ticketStatusLabelKey,
  ticketTimelineKindTheme,
  ticketUserLabel,
} from '@/utils/ticket-presenter'

/**
 * 工单时间线：把后端合并后的回复、内部备注、状态流转与系统事件按时间升序渲染。
 * 用户侧不会拿到内部备注（后端过滤），这里仍保留标记以便管理后台复用。
 */
defineOptions({ name: 'TicketTimeline' })

defineProps<{ entries: TicketTimelineEntry[] }>()
const { t } = useI18n()
</script>

<template>
  <ol v-if="entries.length" class="ticket-timeline">
    <li v-for="entry in entries" :key="entry.id" class="ticket-timeline__item">
      <div class="ticket-timeline__head">
        <t-tag size="small" variant="light" :theme="ticketTimelineKindTheme(entry.kind)">
          {{ t(`ticketPage.timelineKind.${entry.kind}`) }}
        </t-tag>
        <t-tag v-if="entry.internal" size="small" variant="outline" theme="warning">
          {{ t('ticketPage.internalNote') }}
        </t-tag>
        <span v-if="entry.status" class="ticket-timeline__status">
          {{ t(ticketStatusLabelKey(entry.status)) }}
        </span>
        <span class="ticket-timeline__author">
          {{ ticketUserLabel(entry.author) || t('ticketPage.systemAuthor') }}
        </span>
        <time v-if="entry.createdAt" class="ticket-timeline__time">
          {{ formatDateTime(entry.createdAt) }}
        </time>
      </div>
      <p v-if="entry.body" class="ticket-timeline__body">{{ entry.body }}</p>
    </li>
  </ol>
  <p v-else class="ticket-timeline__empty">{{ t('ticketPage.timelineEmpty') }}</p>
</template>

<style scoped lang="less">
.ticket-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    padding: 12px 16px;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__status {
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__author {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__time {
    margin-left: auto;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__body {
    margin: 8px 0 0;
    line-height: 22px;
    color: @beacon-text-primary;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
