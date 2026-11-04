<script setup lang="ts">
import RumProjectOverview from '@/components/rum/RumProjectOverview.vue'
import RumProjectRecords from '@/components/rum/RumProjectRecords.vue'

defineProps<{ section: 'overview' | 'errors' | 'events' }>()
</script>

<template>
  <RumProjectOverview v-if="section === 'overview'" />
  <RumProjectRecords
    v-else
    :kind="section"
  />
</template>
