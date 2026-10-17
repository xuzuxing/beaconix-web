<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CreateTicketCategoryParams, TicketCategory } from '@/api/types/ticket'
import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import { useAdminTicketCategories } from '@/composables/useAdminTicketCategories'
import { usePageHeader } from '@/composables/usePageHeader'
import { PlusSignIcon, RefreshIcon } from '@/icons'
import { useUserStore } from '@/stores'
import { formatDateTime } from '@/utils/billing'

/**
 * 管理后台 · 工单分类（仅 SUPER_ADMIN）。
 * 不进侧边栏：入口是工单管理页动作区的「分类管理」，作为二级页面打开，
 * 标题栏左侧的返回按钮回到工单管理。
 *
 * 分类的读接口只有用户侧 `GET /tickets/categories`（只返回启用项），
 * 因此停用后的分类不会再出现在这里，页面把这个限制写在副标题里。
 */
defineOptions({ name: 'AdminTicketCategoriesView' })

const { t } = useI18n()
const userStore = useUserStore()
const { categories, loading, error, creating, actingId, load, create, update, remove } =
  useAdminTicketCategories()

usePageHeader({ title: t('adminPage.ticketCategory.title'), back: '/admin/tickets' })

// ---------- 新建 / 编辑弹窗 ----------
const formVisible = ref(false)
const editing = ref<TicketCategory | null>(null)
const formError = ref('')
const form = reactive({
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
})

function openCreate() {
  editing.value = null
  formError.value = ''
  Object.assign(form, { name: '', description: '', sortOrder: 0, isActive: true })
  formVisible.value = true
}

function openEdit(category: TicketCategory) {
  editing.value = category
  formError.value = ''
  Object.assign(form, {
    name: category.name,
    description: category.description ?? '',
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  })
  formVisible.value = true
}

async function submitForm() {
  const name = form.name.trim()
  if (!name) {
    formError.value = t('adminPage.ticketCategory.required')
    return
  }

  const payload: CreateTicketCategoryParams = {
    name,
    sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 0,
    isActive: form.isActive,
  }
  if (form.description.trim()) payload.description = form.description.trim()

  const target = editing.value
  const done = target ? await update(target.id, payload) : await create(payload)
  if (!done) return

  MessagePlugin.success(
    t(target ? 'adminPage.ticketCategory.updated' : 'adminPage.ticketCategory.created'),
  )
  formVisible.value = false
}

/** 停用 / 启用：停用后该分类只保留在历史工单上，不再出现在提交下拉里 */
async function toggleActive(category: TicketCategory) {
  const done = await update(category.id, { isActive: !category.isActive })
  if (!done) return
  MessagePlugin.success(
    t(category.isActive ? 'adminPage.ticketCategory.disabled' : 'adminPage.ticketCategory.enabled'),
  )
}

// ---------- 删除确认 ----------
const removeVisible = ref(false)
const removeTarget = ref<TicketCategory | null>(null)

function askRemove(category: TicketCategory) {
  removeTarget.value = category
  removeVisible.value = true
}

async function confirmRemove() {
  const target = removeTarget.value
  removeVisible.value = false
  if (!target) return
  const done = await remove(target.id)
  if (!done) return
  MessagePlugin.success(t('adminPage.ticketCategory.deleted'))
}

onMounted(() => {
  if (userStore.isSuperAdmin) void load()
})
</script>

<template>
  <section class="ticket-categories">
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
      <t-button theme="primary" :disabled="!userStore.isSuperAdmin" @click="openCreate">
        <template #icon><AppIcon :icon="PlusSignIcon" /></template>
        {{ t('adminPage.ticketCategory.create') }}
      </t-button>
    </HeaderActions>

    <t-alert
      v-if="!userStore.isSuperAdmin"
      theme="info"
      :message="t('adminPage.common.noPermission')"
    />

    <t-card v-else class="ticket-categories__panel">
      <template #title>{{ t('adminPage.ticketCategory.title') }}</template>
      <template #actions>
        <span class="ticket-categories__total">{{ categories.length }}</span>
      </template>

      <p class="ticket-categories__subtitle">{{ t('adminPage.ticketCategory.subtitle') }}</p>
      <t-alert
        theme="info"
        :message="t('adminPage.ticketCategory.onlyActiveHint')"
        class="ticket-categories__hint"
      />

      <div v-if="error" class="ticket-categories__state">
        <t-alert theme="error" :message="error" />
        <t-button variant="outline" @click="load">{{ t('adminPage.common.refresh') }}</t-button>
      </div>

      <div v-else-if="loading && !categories.length" class="ticket-categories__state">
        <t-loading :text="t('common.loading')" />
      </div>

      <template v-else-if="categories.length">
        <div class="ticket-categories__table">
          <div class="ticket-categories__table-head">
            <span>{{ t('adminPage.common.name') }}</span>
            <span>{{ t('adminPage.ticketCategory.description') }}</span>
            <span>{{ t('adminPage.ticketCategory.sortOrder') }}</span>
            <span>{{ t('adminPage.common.status') }}</span>
            <span>{{ t('adminPage.common.createdAt') }}</span>
            <span>{{ t('adminPage.common.actions') }}</span>
          </div>
          <div v-for="category in categories" :key="category.id" class="ticket-categories__row">
            <span class="ticket-categories__name">{{ category.name }}</span>
            <span class="ticket-categories__muted">{{ category.description || '—' }}</span>
            <span class="ticket-categories__muted">{{ category.sortOrder }}</span>
            <span>
              <t-tag
                size="small"
                variant="light"
                :theme="category.isActive ? 'success' : 'default'"
              >
                {{
                  category.isActive ? t('adminPage.common.active') : t('adminPage.common.inactive')
                }}
              </t-tag>
            </span>
            <span class="ticket-categories__muted">{{ formatDateTime(category.createdAt) }}</span>
            <span class="ticket-categories__actions">
              <t-button variant="text" size="small" @click="openEdit(category)">
                {{ t('adminPage.ticketCategory.edit') }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                :loading="actingId === category.id"
                @click="toggleActive(category)"
              >
                {{
                  category.isActive
                    ? t('adminPage.ticketCategory.disable')
                    : t('adminPage.ticketCategory.enable')
                }}
              </t-button>
              <t-button
                variant="text"
                size="small"
                theme="danger"
                :loading="actingId === category.id"
                @click="askRemove(category)"
              >
                {{ t('adminPage.ticketCategory.delete') }}
              </t-button>
            </span>
          </div>
        </div>
      </template>

      <div v-else class="ticket-categories__state">
        <p class="ticket-categories__empty">{{ t('adminPage.ticketCategory.empty') }}</p>
        <t-button theme="primary" @click="openCreate">
          {{ t('adminPage.ticketCategory.create') }}
        </t-button>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="formVisible"
      :header="editing ? t('adminPage.ticketCategory.edit') : t('adminPage.ticketCategory.create')"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        loading: creating || Boolean(actingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="submitForm"
    >
      <t-alert
        v-if="formError"
        theme="error"
        :message="formError"
        class="ticket-categories__error"
      />

      <t-form label-align="top" :colon="false" :data="form">
        <t-form-item :label="t('adminPage.common.name')">
          <t-input
            v-model="form.name"
            :maxlength="60"
            :placeholder="t('adminPage.ticketCategory.namePlaceholder')"
          />
        </t-form-item>
        <t-form-item :label="t('adminPage.ticketCategory.description')">
          <t-textarea
            v-model="form.description"
            :maxlength="300"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :placeholder="t('adminPage.ticketCategory.descriptionPlaceholder')"
          />
        </t-form-item>
        <t-form-item :label="t('adminPage.ticketCategory.sortOrder')">
          <t-input-number v-model="form.sortOrder" :min="0" :max="9999" :step="1" theme="normal" />
        </t-form-item>
        <t-form-item :label="t('adminPage.common.status')">
          <t-switch v-model="form.isActive" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="removeVisible"
      :header="t('adminPage.ticketCategory.delete')"
      width="min(520px, calc(100vw - 32px))"
      :confirm-btn="{
        content: t('adminPage.common.confirm'),
        theme: 'danger',
        loading: Boolean(actingId),
      }"
      :cancel-btn="t('adminPage.common.cancel')"
      @confirm="confirmRemove"
    >
      <p class="ticket-categories__confirm">
        {{ t('adminPage.ticketCategory.deleteConfirm', { name: removeTarget?.name ?? '' }) }}
      </p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.ticket-categories {
  min-width: 0;

  &__panel {
    min-width: 0;
  }

  &__total {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__subtitle {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__hint {
    margin-bottom: 16px;
  }

  &__table {
    overflow-x: auto;
    border-top: 1px solid @beacon-border;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) minmax(200px, 2fr) 80px 100px 150px 220px;
    gap: 12px;
    align-items: center;
    min-width: 940px;
    padding: 10px 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__table-head {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-secondary;
    background: @beacon-bg-page;
  }

  &__name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__muted {
    overflow: hidden;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty,
  &__confirm {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    color: @beacon-text-primary;
  }

  &__error {
    margin-bottom: 16px;
  }
}
</style>
