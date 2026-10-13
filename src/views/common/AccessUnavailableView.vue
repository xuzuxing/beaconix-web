<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <section class="access-unavailable">
    <t-empty :description="t('access.unavailable')" />
    <router-link to="/team">{{ t('workspace.teamSelect.title') }}</router-link>
    <router-link to="/notifications">{{ t('menu.notifications') }}</router-link>
  </section>
</template>
<style scoped>
.access-unavailable {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 16px;
  min-height: 50vh;
  padding: 24px;
}
</style>
