<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NotificationChannelType } from '@/api/types/notification'
import { channelTypeTheme } from '@/utils/channel-presenter'

const props = defineProps<{ type: NotificationChannelType }>()
const { t } = useI18n()
const theme = computed(() => channelTypeTheme[props.type])
</script>

<template>
  <t-tag
    :theme="theme"
    size="small"
    variant="light"
    >{{ t(`channelPage.type.${type}`) }}</t-tag
  >
</template>
