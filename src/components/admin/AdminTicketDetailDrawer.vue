<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AttachmentRef } from '@/api/types/attachment'
import type {
  TicketCategory,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  UpdateTicketParams,
} from '@/api/types/ticket'
import TicketAttachmentList from '@/components/support/TicketAttachmentList.vue'
import TicketAttachmentsField from '@/components/support/TicketAttachmentsField.vue'
import TicketTimeline from '@/components/support/TicketTimeline.vue'
import { formatDateTime } from '@/utils/billing'
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ticketAssigneeLabel,
  ticketAuthorLabel,
  ticketNumberLabel,
  ticketOrganizationLabel,
  ticketPriorityLabelKey,
  ticketPriorityTheme,
  ticketStatusLabelKey,
  ticketStatusTheme,
  ticketTimelineOf,
} from '@/utils/ticket-presenter'

/**
 * 管理端工单详情抽屉：工单信息 + 内部备注时间线 + 状态 / 优先级 / 分类 / 处理人的就地修改，
 * 以及公开回复（或内部备注）与删除入口。所有变更都抛给页面执行，抽屉本身不发请求。
 */
defineOptions({ name: 'AdminTicketDetailDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    detail: TicketDetail | null
    categories: TicketCategory[]
    loading?: boolean
    /** 有操作进行中：禁用保存 / 回复 / 删除 */
    busy?: boolean
    /** 页面上一次回复成功的时间戳，用于清空抽屉里的回复草稿 */
    sentAt?: number
  }>(),
  { loading: false, busy: false, sentAt: 0 },
)
const emit = defineEmits<{
  update: [patch: UpdateTicketParams]
  reply: [
    payload: {
      body: string
      isInternalNote: boolean
      attachments: AttachmentRef[]
    },
  ]
  remove: []
}>()
const { t } = useI18n()

const form = reactive<{
  status: TicketStatus
  priority: TicketPriority
  categoryId: string
  assigneeDraft: string
}>({ status: 'OPEN', priority: 'MEDIUM', categoryId: '', assigneeDraft: '' })

const replyBody = ref('')
const replyAttachments = ref<AttachmentRef[]>([])
const internalNote = ref(false)

function syncForm() {
  const detail = props.detail
  if (!detail) return
  form.status = detail.status
  form.priority = detail.priority
  form.categoryId = detail.categoryId ?? detail.category?.id ?? ''
  form.assigneeDraft = detail.assigneeId ?? ''
}

// 切到另一张工单时重置草稿；同一张工单刷新（保存后重拉）时只同步表单
watch(
  () => props.detail?.id,
  () => {
    replyBody.value = ''
    replyAttachments.value = []
    internalNote.value = false
    syncForm()
  },
  { immediate: true },
)
watch(() => props.detail, syncForm)

// 回复成功：页面递增 sentAt，清空草稿；失败时保留内容便于重试
watch(
  () => props.sentAt,
  (value) => {
    if (!value) return
    replyBody.value = ''
    replyAttachments.value = []
    internalNote.value = false
  },
)

const timeline = computed(() =>
  props.detail ? ticketTimelineOf(props.detail) : [],
)

const statusOptions = computed(() =>
  TICKET_STATUSES.map((status) => ({
    label: t(ticketStatusLabelKey(status)),
    value: status,
  })),
)

const priorityOptions = computed(() =>
  TICKET_PRIORITIES.map((priority) => ({
    label: t(ticketPriorityLabelKey(priority)),
    value: priority,
  })),
)

const categoryOptions = computed(() =>
  props.categories.map((category) => ({
    label: category.name,
    value: category.id,
  })),
)

const originalCategory = computed(
  () => props.detail?.categoryId ?? props.detail?.category?.id ?? '',
)
const originalAssignee = computed(() => props.detail?.assigneeId ?? '')

/** 表单与详情有差异时才允许保存，避免无意义的 PATCH */
const dirty = computed(() => {
  const detail = props.detail
  if (!detail) return false
  return (
    form.status !== detail.status ||
    form.priority !== detail.priority ||
    form.categoryId !== originalCategory.value ||
    form.assigneeDraft.trim() !== originalAssignee.value
  )
})

/** 只提交改动过的字段；分类与处理人用显式 null 表示清空 */
function save() {
  const detail = props.detail
  if (!detail || !dirty.value || props.busy) return

  const patch: UpdateTicketParams = {}
  if (form.status !== detail.status) patch.status = form.status
  if (form.priority !== detail.priority) patch.priority = form.priority
  if (form.categoryId !== originalCategory.value)
    patch.categoryId = form.categoryId || null

  const assignee = form.assigneeDraft.trim()
  if (assignee !== originalAssignee.value) patch.assigneeId = assignee || null

  emit('update', patch)
}

function sendReply() {
  const body = replyBody.value.trim()
  if (!body || props.busy) return
  emit('reply', {
    body,
    isInternalNote: internalNote.value,
    attachments: replyAttachments.value,
  })
}
</script>

<template>
  <t-drawer
    v-model:visible="visible"
    size="min(680px, 100vw)"
    :header="t('adminPage.ticket.detailTitle')"
    :footer="false"
  >
    <div
      v-if="loading"
      class="ticket-drawer__state"
    >
      <t-loading :text="t('common.loading')" />
    </div>

    <div
      v-else-if="detail"
      class="ticket-drawer"
    >
      <header class="ticket-drawer__head">
        <span class="ticket-drawer__number">{{
          ticketNumberLabel(detail.number)
        }}</span>
        <t-tag
          size="small"
          variant="light"
          :theme="ticketStatusTheme(detail.status)"
        >
          {{ t(ticketStatusLabelKey(detail.status)) }}
        </t-tag>
        <t-tag
          size="small"
          variant="light"
          :theme="ticketPriorityTheme(detail.priority)"
        >
          {{ t(ticketPriorityLabelKey(detail.priority)) }}
        </t-tag>
        <span class="ticket-drawer__subject">{{ detail.subject }}</span>
      </header>

      <dl class="ticket-drawer__info">
        <div>
          <dt>{{ t('ticketPage.author') }}</dt>
          <dd>{{ ticketAuthorLabel(detail) }}</dd>
        </div>
        <div>
          <dt>{{ t('ticketPage.organization') }}</dt>
          <dd>{{ ticketOrganizationLabel(detail.organizationId) || '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('ticketPage.createdAt') }}</dt>
          <dd>{{ formatDateTime(detail.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('ticketPage.updatedAt') }}</dt>
          <dd>{{ formatDateTime(detail.updatedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.ticket.firstRespondedAt') }}</dt>
          <dd>{{ formatDateTime(detail.firstRespondedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.ticket.resolvedAt') }}</dt>
          <dd>{{ formatDateTime(detail.resolvedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('adminPage.ticket.closedAt') }}</dt>
          <dd>{{ formatDateTime(detail.closedAt) }}</dd>
        </div>
        <div>
          <dt>{{ t('ticketPage.assignee') }}</dt>
          <dd>
            {{ ticketAssigneeLabel(detail) || t('ticketPage.unassigned') }}
          </dd>
        </div>
        <div class="ticket-drawer__wide">
          <dt>{{ t('ticketPage.number') }}</dt>
          <dd class="ticket-drawer__mono">{{ detail.id }}</dd>
        </div>
      </dl>

      <section class="ticket-drawer__section">
        <h4 class="ticket-drawer__section-title">
          {{ t('ticketPage.content') }}
        </h4>
        <p class="ticket-drawer__content">{{ detail.content }}</p>
      </section>

      <section
        v-if="detail.attachments?.length"
        class="ticket-drawer__section"
      >
        <h4 class="ticket-drawer__section-title">
          {{ t('ticketPage.attachments') }}
        </h4>
        <TicketAttachmentList :attachments="detail.attachments" />
      </section>

      <section class="ticket-drawer__section">
        <h4 class="ticket-drawer__section-title">
          {{ t('adminPage.ticket.updateTitle') }}
        </h4>
        <div class="ticket-drawer__form">
          <label>
            <span>{{ t('ticketPage.status') }}</span>
            <t-select
              v-model="form.status"
              :options="statusOptions"
            />
          </label>
          <label>
            <span>{{ t('ticketPage.priority') }}</span>
            <t-select
              v-model="form.priority"
              :options="priorityOptions"
            />
          </label>
          <label>
            <span>{{ t('ticketPage.category') }}</span>
            <t-select
              v-model="form.categoryId"
              :options="categoryOptions"
              clearable
              :placeholder="t('adminPage.ticket.categoryPlaceholder')"
            />
          </label>
          <label>
            <span>{{ t('ticketPage.assignee') }}</span>
            <t-input
              v-model="form.assigneeDraft"
              :placeholder="t('adminPage.ticket.assigneePlaceholder')"
            />
          </label>
        </div>
        <div class="ticket-drawer__row">
          <t-button
            theme="primary"
            size="small"
            :loading="busy"
            :disabled="!dirty"
            @click="save"
          >
            {{ t('adminPage.ticket.save') }}
          </t-button>
          <span class="ticket-drawer__hint">{{
            t('adminPage.ticket.updateHint')
          }}</span>
        </div>
      </section>

      <section class="ticket-drawer__section">
        <h4 class="ticket-drawer__section-title">
          {{ t('adminPage.ticket.replyTitle') }}
        </h4>
        <t-textarea
          v-model="replyBody"
          :maxlength="5000"
          :placeholder="t('adminPage.ticket.replyPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
        <TicketAttachmentsField
          v-model="replyAttachments"
          :disabled="busy"
        />
        <div class="ticket-drawer__row">
          <t-checkbox v-model="internalNote">{{
            t('ticketPage.internalNote')
          }}</t-checkbox>
          <span class="ticket-drawer__hint">{{
            t('adminPage.ticket.internalHint')
          }}</span>
        </div>
        <div class="ticket-drawer__row">
          <t-button
            theme="primary"
            size="small"
            :loading="busy"
            :disabled="!replyBody.trim()"
            @click="sendReply"
          >
            {{ t('adminPage.ticket.reply') }}
          </t-button>
        </div>
      </section>

      <section class="ticket-drawer__section">
        <h4 class="ticket-drawer__section-title">
          {{ t('ticketPage.timelineTitle') }}
        </h4>
        <TicketTimeline :entries="timeline" />
      </section>

      <section class="ticket-drawer__section">
        <t-button
          theme="danger"
          variant="outline"
          size="small"
          :disabled="busy"
          @click="emit('remove')"
        >
          {{ t('adminPage.ticket.delete') }}
        </t-button>
        <span class="ticket-drawer__hint">{{
          t('adminPage.ticket.deleteHint')
        }}</span>
      </section>
    </div>

    <div
      v-else
      class="ticket-drawer__state"
    >
      <p class="ticket-drawer__empty">{{ t('adminPage.ticket.notFound') }}</p>
    </div>
  </t-drawer>
</template>

<style scoped lang="less">
.ticket-drawer {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__number {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__subject {
    font-size: @beacon-font-size-menu;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  &__info {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 16px;
    margin: 0;

    dt {
      font-size: @beacon-font-size-caption;
      color: @beacon-text-tertiary;
    }

    dd {
      margin: 2px 0 0;
      font-size: @beacon-font-size-base;
      color: @beacon-text-primary;
      overflow-wrap: anywhere;
    }
  }

  &__wide {
    grid-column: 1 / -1;
  }

  &__mono {
    font-family: @beacon-font-family-code;
    word-break: break-all;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__section-title {
    margin: 0;
    font-size: @beacon-font-size-menu;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__content {
    margin: 0;
    line-height: 22px;
    color: @beacon-text-secondary;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: @beacon-font-size-caption;
      color: @beacon-text-tertiary;
    }
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  &__hint {
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}

@media (max-width: 600px) {
  .ticket-drawer__form,
  .ticket-drawer__info {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
