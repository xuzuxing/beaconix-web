<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ loading: boolean; error: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>
<template>
  <t-loading :loading="loading"
    ><div
      v-if="error"
      role="alert"
    >
      <t-alert
        theme="error"
        :message="t('rum.loadFailed')"
      /><t-button
        variant="text"
        @click="emit('retry')"
        >{{ t('rum.retry') }}</t-button
      >
    </div>
    <slot v-else
  /></t-loading>
</template>
