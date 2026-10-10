<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NotificationLog } from '@/api/types/notification'
import AppIcon from '@/components/AppIcon.vue'
import { ChevronsDownUpIcon } from '@/icons'
import { formatMonitorTime } from '@/utils/monitor-presenter'

defineProps<{ log: NotificationLog }>()
const { t, locale } = useI18n()
const expanded = ref(false)
</script>

<template>
  <article class="channel-log">
    <div class="channel-log__head">
      <t-tag :theme="log.status === 'SUCCESS' ? 'success' : 'danger'" size="small" variant="light">
        {{ t(`channelPage.delivery.${log.status}`) }}
      </t-tag>
      <time class="channel-log__time">{{ formatMonitorTime(log.createdAt, locale) }}</time>
      <span v-if="log.monitorName" class="channel-log__monitor">{{ log.monitorName }}</span>
    </div>
    <p v-if="log.error" class="channel-log__error">{{ log.error }}</p>
    <button type="button" class="channel-log__toggle" @click="expanded = !expanded">
      <AppIcon :icon="ChevronsDownUpIcon" :size="14" />
      {{ t('channelPage.rawPayload') }}
    </button>
    <pre v-if="expanded" class="channel-log__raw">{{ JSON.stringify(log, null, 2) }}</pre>
  </article>
</template>

<style scoped lang="less">
.channel-log {
  padding: 12px 0;
  border-bottom: 1px solid @beacon-border;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__time {
    color: @beacon-text-secondary;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  &__monitor {
    color: @beacon-text-primary;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  &__error {
    margin: 8px 0 0;
    color: @beacon-error;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
    background: none;
    border: 0;
    cursor: pointer;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__raw {
    margin: 8px 0 0;
    padding: 12px;
    max-height: 240px;
    overflow: auto;
    color: @beacon-text-secondary;
    font-size: 12px;
    background: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }
}
</style>
