<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MonitorStatus } from '@/api/types'
import { monitorStatusTheme } from '@/utils/monitor-presenter'

defineProps<{ status: MonitorStatus }>()
const { t } = useI18n()
</script>

<template>
  <t-tag
    :theme="monitorStatusTheme[status]"
    variant="light"
    size="small"
  >
    {{ t(`workspace.monitor.status.${status}`) }}
  </t-tag>
</template>
