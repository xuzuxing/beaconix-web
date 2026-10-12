<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ enabled: boolean }>()
const { t } = useI18n()
</script>

<template>
  <t-tag :theme="enabled ? 'success' : 'default'" size="small" variant="light">
    {{ t(enabled ? 'statusPage.enabled' : 'statusPage.disabled') }}
  </t-tag>
</template>
