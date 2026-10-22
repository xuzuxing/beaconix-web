<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import AdminSettingField from '@/components/admin/AdminSettingField.vue'
import { useAdminSettings } from '@/composables/useAdminSettings'
import type { SettingTab } from '@/utils/settings-presenter'
import { RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'

/**
 * 管理后台 · 平台配置。
 *
 * 顶部 tab 来自 `develop.configGroup` 声明并分组好的配置项（每个 tab = 一个 group），
 * 每个 tab 内是一个表单：改完点「保存本组」，只提交本组内有改动的项。仅 SUPER_ADMIN。
 */
defineOptions({ name: 'AdminSettingsView' })

const { t, te } = useI18n()
const userStore = useUserStore()
const {
  settings,
  tabs,
  loading,
  error,
  savingGroup,
  draftOf,
  setDraft,
  isDirty,
  dirtyCount,
  load,
  saveGroup,
  resetGroup,
} = useAdminSettings()

const activeTab = ref('')

/** 窄屏把标签挪到输入框上方，避免左列标签挤扁控件 */
const isNarrow = useMediaQuery('(max-width: 720px)')
const labelAlign = computed(() => (isNarrow.value ? 'top' : 'left'))
const labelWidth = computed(() => (isNarrow.value ? undefined : 160))

/** 分组 key → 文案 key；未收录的分组直接显示 key 本身，方便后端新增分组时先顶着用 */
const GROUP_LABEL_KEYS: Record<string, string> = {
  system: 'adminPage.setting.group.system',
  develop: 'adminPage.setting.group.develop',
  organization: 'adminPage.setting.group.organization',
  project: 'adminPage.setting.group.project',
  task: 'adminPage.setting.group.task',
  sprint: 'adminPage.setting.group.sprint',
  monitor: 'adminPage.setting.group.monitor',
  shared: 'adminPage.setting.group.shared',
  storage: 'adminPage.setting.group.storage',
  attachments: 'adminPage.setting.group.attachments',
  smtp: 'adminPage.setting.group.smtp',
  wechat: 'adminPage.setting.group.wechat',
  alipay: 'adminPage.setting.group.alipay',
  billing: 'adminPage.setting.group.billing',
}

function groupLabel(key: string) {
  const path = GROUP_LABEL_KEYS[key]
  return path && te(path) ? t(path) : key
}

function groupHint(key: string) {
  const path = `adminPage.setting.groupHint.${key}`
  return te(path) ? t(path) : ''
}

/** tab 内的二级分组 key → 文案 key；未收录的 section 直接显示 key 本身 */
const SECTION_LABEL_KEYS: Record<string, string> = {
  pay: 'adminPage.setting.section.pay',
  miniprogram: 'adminPage.setting.section.miniprogram',
  website: 'adminPage.setting.section.website',
  scanLogin: 'adminPage.setting.section.scanLogin',
  officialAccount: 'adminPage.setting.section.officialAccount',
  work: 'adminPage.setting.section.work',
  http: 'adminPage.setting.section.http',
  refund: 'adminPage.setting.section.refund',
}

function sectionLabel(key: string) {
  const path = SECTION_LABEL_KEYS[key]
  return path && te(path) ? t(path) : key
}

function sectionHint(key: string) {
  const path = `adminPage.setting.sectionHint.${key}`
  return te(path) ? t(path) : ''
}

/** 该 tab 是否按 section 分块展示：只有确实声明了 section 才显示小标题 */
function tabHasSections(tab: SettingTab) {
  return tab.sections.some((section) => Boolean(section.key))
}

/** 保存后分组清单可能变化（比如改了 develop.configGroup），保证当前 tab 仍然存在 */
watch(
  tabs,
  (next) => {
    if (!next.some((tab) => tab.key === activeTab.value))
      activeTab.value = next[0]?.key ?? ''
  },
  { immediate: true },
)

async function save(group: string) {
  if (savingGroup.value) return
  const result = await saveGroup(group)

  if (result.invalid) {
    MessagePlugin.error(
      t(`adminPage.setting.invalid.${result.invalid.reason}`, {
        key: result.invalid.key,
      }),
    )
    return
  }
  if (result.total === 0) {
    MessagePlugin.info(t('adminPage.setting.unchanged'))
    return
  }
  if (result.error) {
    // 逐项提交、失败即停：已经写成功的项保留，明确告诉用户进度
    if (result.saved > 0) {
      MessagePlugin.warning(
        t('adminPage.setting.savePartial', {
          saved: result.saved,
          total: result.total,
        }),
      )
    }
    return
  }
  MessagePlugin.success(
    t('adminPage.setting.saveSuccess', { count: result.saved }),
  )
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="admin-settings">
    <HeaderActions>
      <t-tooltip :content="t('adminPage.common.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :disabled="!userStore.isSuperAdmin"
          :aria-label="t('adminPage.common.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <t-card
      v-else
      class="admin-settings__panel"
    >
      <template #title>{{ t('adminPage.setting.title') }}</template>
      <template #actions>
        <span class="admin-settings__summary">
          {{ t('adminPage.setting.itemCount', { count: settings.length }) }}
        </span>
      </template>

      <p class="admin-settings__subtitle">
        {{ t('adminPage.setting.subtitle') }}
      </p>

      <div
        v-if="error"
        class="admin-settings__state"
      >
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button
          variant="outline"
          @click="load"
          >{{ t('adminPage.common.refresh') }}</t-button
        >
      </div>

      <div
        v-else-if="loading && !settings.length"
        class="admin-settings__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>

      <div
        v-else-if="!tabs.length"
        class="admin-settings__state"
      >
        <p class="admin-settings__empty">{{ t('adminPage.setting.empty') }}</p>
      </div>

      <t-tabs
        v-else
        v-model="activeTab"
        class="admin-settings__tabs"
      >
        <t-tab-panel
          v-for="tab in tabs"
          :key="tab.key"
          :value="tab.key"
          :label="groupLabel(tab.key)"
        >
          <p
            v-if="groupHint(tab.key)"
            class="admin-settings__group-hint"
          >
            {{ groupHint(tab.key) }}
          </p>

          <div
            v-if="!tab.items.length"
            class="admin-settings__state"
          >
            <p class="admin-settings__empty">
              {{ t('adminPage.setting.groupEmpty') }}
            </p>
          </div>

          <template v-else>
            <t-form
              class="admin-settings__form"
              :label-align="labelAlign"
              :label-width="labelWidth"
              :colon="false"
            >
              <template
                v-for="section in tab.sections"
                :key="section.key || '__default'"
              >
                <div
                  v-if="tabHasSections(tab) && section.key"
                  class="admin-settings__section"
                >
                  <h3 class="admin-settings__section-title">
                    {{ sectionLabel(section.key) }}
                  </h3>
                  <p
                    v-if="sectionHint(section.key)"
                    class="admin-settings__section-hint"
                  >
                    {{ sectionHint(section.key) }}
                  </p>
                </div>
                <AdminSettingField
                  v-for="item in section.items"
                  :key="item.key"
                  :item="item"
                  :draft="draftOf(item)"
                  :dirty="isDirty(item)"
                  :disabled="savingGroup === tab.key"
                  @update:draft="(value) => setDraft(item.key, value)"
                />
              </template>
            </t-form>

            <div class="admin-settings__actions">
              <t-button
                theme="primary"
                :loading="savingGroup === tab.key"
                :disabled="!dirtyCount(tab.key)"
                @click="save(tab.key)"
              >
                {{ t('adminPage.setting.save') }}
              </t-button>
              <t-button
                variant="outline"
                :disabled="!dirtyCount(tab.key) || savingGroup === tab.key"
                @click="resetGroup(tab.key)"
              >
                {{ t('adminPage.setting.reset') }}
              </t-button>
              <span class="admin-settings__dirty-count">
                {{
                  dirtyCount(tab.key)
                    ? t('adminPage.setting.dirty', {
                        count: dirtyCount(tab.key),
                      })
                    : t('adminPage.setting.clean')
                }}
              </span>
            </div>
          </template>
        </t-tab-panel>
      </t-tabs>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.admin-settings {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__summary,
  &__subtitle {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 16px;
  }

  &__tabs {
    min-width: 0;
  }

  &__group-hint {
    margin: 4px 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__section {
    margin-top: 20px;

    &:first-child {
      margin-top: 0;
    }
  }

  &__section-title {
    margin: 0 0 4px;
    font-size: @beacon-font-size-base;
    font-weight: 600;
  }

  &__section-hint {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__form {
    max-width: 860px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid @beacon-border;
  }

  &__dirty-count {
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 160px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
