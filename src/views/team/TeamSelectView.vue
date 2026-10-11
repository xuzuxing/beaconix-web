<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import { HOME_PATH } from '@/config'
import { RefreshIcon, Search01Icon, TeamWorkIcon } from '@/icons'
import { useOrganizationStore } from '@/stores'

/**
 * 选择团队：控制台之外的独立整页（只有精简顶栏，无侧边菜单）。
 * 选中某个团队后切换当前团队，并进入该团队的控制台。
 */
defineOptions({ name: 'TeamSelectView' })

const { t } = useI18n()
const router = useRouter()
const orgStore = useOrganizationStore()

const keyword = ref('')
const loading = ref(false)

const teams = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return orgStore.organizations
  return orgStore.organizations.filter(
    (org) => org.name.toLowerCase().includes(kw) || org.slug.toLowerCase().includes(kw),
  )
})

async function load() {
  loading.value = true
  try {
    await orgStore.loadOrganizations()
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

/** 进入所选团队的控制台 */
async function enter(id: string) {
  await orgStore.switchOrganization(id)
  await router.push(HOME_PATH)
}
</script>

<template>
  <div class="team-select">
    <div class="team-select__header">
      <h2 class="team-select__title">{{ t('workspace.teamSelect.title') }}</h2>
      <button
        type="button"
        class="team-select__refresh"
        :aria-label="t('workspace.teamSelect.refresh')"
        @click="load"
      >
        <AppIcon :icon="RefreshIcon" />
      </button>
      <span class="team-select__subtitle">{{ t('workspace.teamSelect.subtitle') }}</span>
    </div>

    <div class="team-select__panel">
      <div class="team-select__toolbar">
        <t-input
          v-model="keyword"
          class="team-select__search"
          size="small"
          clearable
          :placeholder="t('layout.teamSearch')"
        >
          <template #prefix-icon>
            <AppIcon :icon="Search01Icon" :size="14" />
          </template>
        </t-input>
      </div>

      <div v-if="teams.length" class="team-select__grid">
        <button
          v-for="org in teams"
          :key="org.id"
          type="button"
          class="team-select__card"
          :class="{ 'is-active': org.id === orgStore.currentOrganizationId }"
          @click="enter(org.id)"
        >
          <span class="team-select__card-head">
            <AppIcon class="team-select__icon" :icon="TeamWorkIcon" />
            <span class="team-select__name">{{ org.name }}</span>
            <span v-if="org.id === orgStore.currentOrganizationId" class="team-select__tag">
              {{ t('workspace.team.current') }}
            </span>
          </span>

          <span class="team-select__row">
            <span class="team-select__label">{{ t('layout.teamSlug') }}</span>
            <span class="team-select__text">{{ org.slug }}</span>
          </span>
          <span class="team-select__row">
            <span class="team-select__label">{{ t('layout.teamCreatedAt') }}</span>
            <span class="team-select__text">{{ org.createdAt }}</span>
          </span>
        </button>
      </div>

      <p v-else class="team-select__empty">
        {{ loading ? t('common.loading') : t('workspace.team.empty') }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="less">
.team-select {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 12px 20px 20px;

  &__header {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: 700;
    line-height: 28px;
    color: @beacon-text-primary;
  }

  &__refresh {
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

  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  &__search {
    width: 240px;
  }

  &__grid {
    display: grid;
    align-content: start;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;

    &:hover {
      border-color: @beacon-brand-hover;
    }

    &.is-active {
      border-color: @beacon-brand;
    }
  }

  &__card-head {
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

  &__tag {
    flex: none;
    margin-left: auto;
    padding: 0 6px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-brand;
    background-color: @beacon-brand-light;
    border-radius: @beacon-radius-m;
  }

  &__row {
    display: flex;
    gap: 8px;
    min-width: 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
  }

  &__label {
    flex: none;
    color: @beacon-text-tertiary;
  }

  &__text {
    min-width: 0;
    overflow: hidden;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty {
    margin: 0;
    padding: 48px 0;
    color: @beacon-text-tertiary;
    text-align: center;
  }
}
</style>
