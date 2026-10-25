<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Invitation } from '@/api/types'
defineProps<{ invitation: Pick<Invitation, 'accessMode' | 'projects'> }>()
const { t } = useI18n()
</script>
<template>
  <div class="invitation-scope">
    <span v-if="invitation.accessMode === 'ALL_PROJECTS'">{{
      t('access.allProjects')
    }}</span>
    <t-tag
      v-for="project in invitation.projects"
      v-else
      :key="project.projectId"
      size="small"
      variant="outline"
    >
      {{ project.projectName }} · {{ t(`access.role.${project.role}`) }}
    </t-tag>
  </div>
</template>
<style scoped>
.invitation-scope {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
  min-width: 0;
}
.invitation-scope :deep(.t-tag) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
