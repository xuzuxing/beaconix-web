<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Monitor } from '@/api/types'
import type { MonitorAction } from '@/composables/useMonitorActions'
import AppIcon from '@/components/AppIcon.vue'
import { Delete02Icon, Edit02Icon, FlashIcon, PauseIcon, PlayIcon } from '@/icons'

defineProps<{ monitor: Monitor; pending?: boolean; canManage: boolean; canCheck: boolean }>()
const emit = defineEmits<{ action: [action: MonitorAction]; edit: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="monitor-actions" @click.stop>
    <t-tooltip v-if="canCheck" :content="t('workspace.monitor.checkNow')">
      <t-button
        variant="text"
        shape="square"
        :aria-label="t('workspace.monitor.checkNow')"
        :loading="pending"
        :disabled="pending || !monitor.enabled || monitor.executionEligible === false"
        @click="emit('action', 'check')"
        ><template #icon><AppIcon :icon="FlashIcon" /></template
      ></t-button>
    </t-tooltip>
    <template v-if="canManage">
      <t-tooltip
        :content="t(monitor.enabled ? 'workspace.monitor.pause' : 'workspace.monitor.resume')"
      >
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="t(monitor.enabled ? 'workspace.monitor.pause' : 'workspace.monitor.resume')"
          @click="emit('action', 'toggle')"
          ><AppIcon :icon="monitor.enabled ? PauseIcon : PlayIcon"
        /></t-button>
      </t-tooltip>
      <t-tooltip :content="t('workspace.monitor.edit')">
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="t('workspace.monitor.edit')"
          @click="emit('edit')"
          ><AppIcon :icon="Edit02Icon"
        /></t-button>
      </t-tooltip>
      <t-popconfirm
        :content="t('workspace.monitor.deleteConfirm')"
        @confirm="emit('action', 'delete')"
      >
        <t-button
          variant="text"
          theme="danger"
          shape="square"
          :disabled="pending"
          :title="t('workspace.monitor.delete')"
          :aria-label="t('workspace.monitor.delete')"
        >
          <AppIcon :icon="Delete02Icon" />
        </t-button>
      </t-popconfirm>
    </template>
  </div>
</template>

<style scoped>
.monitor-actions {
  display: flex;
  align-items: center;
  flex: none;
}
</style>
