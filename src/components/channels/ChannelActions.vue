<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { NotificationChannel } from '@/api/types/notification'
import AppIcon from '@/components/AppIcon.vue'
import type { ChannelAction } from '@/composables/useChannelActions'
import {
  Delete02Icon,
  Edit02Icon,
  FlashIcon,
  ListViewIcon,
  PauseIcon,
  PlayIcon,
} from '@/icons'

defineProps<{
  channel: NotificationChannel
  pending?: boolean
  canManage: boolean
}>()
const emit = defineEmits<{
  action: [action: ChannelAction]
  edit: []
  logs: []
}>()
const { t } = useI18n()
</script>

<template>
  <div class="channel-actions">
    <t-tooltip :content="t('channelPage.logs')">
      <t-button
        variant="text"
        shape="square"
        :aria-label="t('channelPage.logs')"
        @click="emit('logs')"
        ><AppIcon :icon="ListViewIcon"
      /></t-button>
    </t-tooltip>
    <template v-if="canManage">
      <t-tooltip :content="t('channelPage.test')">
        <t-button
          variant="text"
          shape="square"
          :loading="pending"
          :disabled="pending"
          :aria-label="t('channelPage.test')"
          @click="emit('action', 'test')"
          ><template #icon><AppIcon :icon="FlashIcon" /></template
        ></t-button>
      </t-tooltip>
      <t-tooltip
        :content="
          t(channel.enabled ? 'channelPage.disable' : 'channelPage.enable')
        "
      >
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="
            t(channel.enabled ? 'channelPage.disable' : 'channelPage.enable')
          "
          @click="emit('action', 'toggle')"
          ><AppIcon :icon="channel.enabled ? PauseIcon : PlayIcon"
        /></t-button>
      </t-tooltip>
      <t-tooltip :content="t('channelPage.edit')">
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="t('channelPage.edit')"
          @click="emit('edit')"
          ><AppIcon :icon="Edit02Icon"
        /></t-button>
      </t-tooltip>
      <t-popconfirm
        :content="t('channelPage.deleteConfirm')"
        @confirm="emit('action', 'delete')"
      >
        <t-button
          variant="text"
          theme="danger"
          shape="square"
          :disabled="pending"
          :aria-label="t('channelPage.delete')"
          ><AppIcon :icon="Delete02Icon"
        /></t-button>
      </t-popconfirm>
    </template>
  </div>
</template>

<style scoped>
.channel-actions {
  display: flex;
  align-items: center;
  flex: none;
}
</style>
