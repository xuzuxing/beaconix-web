<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import StatusPageFieldTags from '@/components/status-pages/StatusPageFieldTags.vue'
import { CheckmarkCircle02Icon, PlusSignIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'
import { STATUS_PAGE_TEMPLATES } from '@/utils/status-page-presenter'

/**
 * 状态页 → 页面模板。
 *
 * 后端没有 status-page-templates 资源（见 docs/menu-structure.md），
 * 因此模板是纯前端预设：只决定新建状态页时的展示开关初值，不落库、
 * 也不会反向影响已创建的状态页。选中模板后跳到「概览页」并带 ?template=<id>&create=1。
 */
defineOptions({ name: 'StatusPageTemplatesView' })
const { t } = useI18n()
const router = useRouter()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)

function useTemplate(id: string) {
  void router.push({
    name: 'status-pages',
    query: { template: id, create: '1' },
  })
}
</script>

<template>
  <section class="status-templates">
    <t-card class="status-templates__card">
      <template #title>{{ t('statusPage.templatesTitle') }}</template>
      <template #actions>
        <span class="status-templates__scope">{{
          org.currentOrganization?.name ?? '-'
        }}</span>
      </template>

      <t-alert
        theme="info"
        :message="t('statusPage.templatesHint')"
        class="status-templates__notice"
      />

      <ul class="status-templates__list">
        <li
          v-for="template in STATUS_PAGE_TEMPLATES"
          :key="template.id"
          class="template-card"
        >
          <div class="template-card__head">
            <span class="template-card__name">
              {{ t(`statusPage.template.${template.id}.name`) }}
            </span>
            <t-tag
              v-if="template.recommended"
              theme="primary"
              variant="light"
              size="small"
            >
              <template #icon
                ><AppIcon :icon="CheckmarkCircle02Icon"
              /></template>
              {{ t('statusPage.template.recommended') }}
            </t-tag>
          </div>

          <p class="template-card__desc">
            {{ t(`statusPage.template.${template.id}.desc`) }}
          </p>

          <div class="template-card__fields">
            <StatusPageFieldTags
              :show-latency="template.showLatency"
              :show-uptime="template.showUptime"
            />
          </div>

          <t-button
            :disabled="!orgId"
            @click="useTemplate(template.id)"
          >
            <template #icon><AppIcon :icon="PlusSignIcon" /></template>
            {{ t('statusPage.template.use') }}
          </t-button>
        </li>
      </ul>

      <p
        v-if="!orgId"
        class="status-templates__empty"
      >
        {{ t('statusPage.noOrganization') }}
      </p>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.status-templates {
  min-width: 0;

  &__scope {
    color: @beacon-text-secondary;
  }

  &__notice {
    margin-bottom: 16px;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: @beacon-gap-l;
  }

  &__empty {
    margin: 16px 0 0;
    color: @beacon-text-secondary;
    text-align: center;
  }
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid @beacon-border;
  border-radius: 6px;
  background: @beacon-bg-page;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__name {
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__desc {
    margin: 0;
    flex: 1;
    font-size: 13px;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__fields {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
}
</style>
