<script setup lang="ts">
import { computed } from 'vue'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { useI18n } from 'vue-i18n'

import type { Organization } from '@/api/types'
import type { Plan } from '@/api/types/billing'
import AppIcon from '@/components/AppIcon.vue'
import { CheckmarkCircle02Icon, Settings01Icon, TeamWorkIcon, UserIcon } from '@/icons'
import { formatDateTime, planTagTheme, planTier } from '@/utils/billing'

/**
 * 选择团队页的单个团队卡片，支持卡片 / 列表两种排布。
 * 点击卡片本体进入该团队；右侧两个入口跳转到该团队的成员页 / 团队管理页。
 */
defineOptions({ name: 'TeamCard' })

const props = withDefaults(
  defineProps<{
    org: Organization
    /** 该团队的套餐，用于名称后的套餐标签 */
    plan: Plan | null
    /** 是否为当前团队 */
    selected?: boolean
    /** 是否由当前用户创建 */
    owned?: boolean
    /** list 模式下卡片改为横向一行 */
    mode?: 'card' | 'list'
  }>(),
  { selected: false, owned: false, mode: 'card' },
)

const emit = defineEmits<{ select: []; manage: []; members: [] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()

const planLabel = computed(() => props.plan?.name ?? t('usage.package.freePlan'))
</script>

<template>
  <div
    class="team-card"
    :class="[`team-card--${mode}`, { 'is-selected': selected }]"
    role="button"
    tabindex="0"
    @click="emit('select')"
    @keydown.enter="emit('select')"
  >
    <div class="team-card__head">
      <AppIcon class="team-card__icon" :icon="TeamWorkIcon" :size="18" />
      <span class="team-card__name">{{ org.name }}</span>
      <span v-if="selected" class="team-card__current">{{ t('workspace.team.current') }}</span>
      <t-tag
        v-if="plan"
        class="team-card__plan beacon-plan-badge"
        :class="`beacon-plan--${planTier(plan)}`"
        :theme="planTagTheme(plan)"
        variant="light"
        size="small"
      >
        {{ planLabel }}
      </t-tag>
    </div>

    <ul class="team-card__info">
      <li class="team-card__row">
        <span class="team-card__label">{{ t('layout.teamSlug') }}</span>
        <span class="team-card__value">{{ org.slug }}</span>
      </li>
      <li class="team-card__row">
        <span class="team-card__label">{{ t('layout.teamCreatedAt') }}</span>
        <span class="team-card__value">{{ formatDateTime(org.createdAt) }}</span>
      </li>
    </ul>

    <div class="team-card__foot">
      <div v-if="permissions.canOrganization(org.id)" class="team-card__entries">
        <button
          type="button"
          class="team-card__entry"
          :title="t('submenu.team.members')"
          :aria-label="t('submenu.team.members')"
          @click.stop="emit('members')"
        >
          <AppIcon :icon="UserIcon" />
        </button>
        <button
          type="button"
          class="team-card__entry"
          :title="t('menu.team')"
          :aria-label="t('menu.team')"
          @click.stop="emit('manage')"
        >
          <AppIcon :icon="Settings01Icon" />
        </button>
      </div>

      <span class="team-card__source">
        {{ t(owned ? 'workspace.teamSelect.filterOwned' : 'workspace.teamSelect.filterJoined') }}
      </span>
    </div>

    <span v-if="selected" class="team-card__check">
      <AppIcon :icon="CheckmarkCircle02Icon" :size="18" />
    </span>
  </div>
</template>

<style scoped lang="less">
.team-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  &:hover {
    border-color: @beacon-brand-hover;
  }

  &.is-selected {
    border-color: @beacon-brand;
  }

  // 列表模式：卡片改为横向一行
  &--list {
    flex-direction: row;
    align-items: center;
    gap: 24px;

    .team-card__head {
      flex: none;
      width: 260px;
    }

    .team-card__info {
      flex: 1;
      flex-direction: row;
      gap: 24px;
      min-width: 0;
    }

    .team-card__foot {
      flex: none;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__icon {
    flex: none;
    color: @beacon-brand;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__current {
    flex: none;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-brand;
    background-color: @beacon-brand-light;
    border-radius: @beacon-radius-m;
  }

  &__plan {
    flex: none;
    margin-left: auto;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
  }

  &__label {
    flex: none;
    color: @beacon-text-tertiary;
  }

  &__value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__entries {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__entry {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  &__source {
    margin-right: 20px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  // 选中勾：右下角（与来源文案留出间距，避免遮挡）
  &__check {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: inline-flex;
    color: @beacon-brand;
  }
}
</style>
