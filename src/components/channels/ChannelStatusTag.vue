<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ enabled: boolean }>()
const { t } = useI18n()
</script>

<template>
  <t-tag
    :theme="enabled ? 'success' : 'default'"
    size="small"
    variant="light"
  >
    {{ t(enabled ? 'channelPage.enabled' : 'channelPage.disabled') }}
  </t-tag>
</template>
