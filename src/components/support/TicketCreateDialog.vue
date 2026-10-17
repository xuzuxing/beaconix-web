<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AttachmentRef } from '@/api/types/attachment'
import type { CreateTicketParams, TicketCategory, TicketPriority } from '@/api/types/ticket'
import TicketAttachmentsField from '@/components/support/TicketAttachmentsField.vue'
import { TICKET_PRIORITIES, ticketPriorityLabelKey } from '@/utils/ticket-presenter'

/**
 * 提交工单：主题 + 分类（可选）+ 优先级 + 问题描述 + 附件（图片 / 日志 / PDF）。
 * 提交由页面完成（composable 里的 submit），这里只做表单校验并把参数抛出去。
 */
defineOptions({ name: 'TicketCreateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    categories: TicketCategory[]
    /** 提交中：禁用确认按钮与遮罩关闭 */
    submitting?: boolean
  }>(),
  { submitting: false },
)
const emit = defineEmits<{ submit: [payload: CreateTicketParams] }>()
const { t } = useI18n()

const form = reactive({
  subject: '',
  categoryId: '',
  priority: 'MEDIUM' as TicketPriority,
  content: '',
})
const attachments = ref<AttachmentRef[]>([])
const error = ref('')

watch(visible, (value) => {
  error.value = ''
  attachments.value = []
  if (!value) return
  Object.assign(form, {
    subject: '',
    categoryId: '',
    priority: 'MEDIUM' as TicketPriority,
    content: '',
  })
})

const priorityOptions = computed(() =>
  TICKET_PRIORITIES.map((priority) => ({
    label: t(ticketPriorityLabelKey(priority)),
    value: priority,
  })),
)

const categoryOptions = computed(() =>
  props.categories.map((category) => ({ label: category.name, value: category.id })),
)

function submit() {
  if (props.submitting) return
  const subject = form.subject.trim()
  const content = form.content.trim()
  if (!subject || !content) {
    error.value = t('ticketPage.required')
    return
  }

  const payload: CreateTicketParams = { subject, content, priority: form.priority }
  if (form.categoryId) payload.categoryId = form.categoryId
  if (attachments.value.length) payload.attachments = attachments.value
  error.value = ''
  emit('submit', payload)
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('ticketPage.createTitle')"
    width="min(560px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('ticketPage.submit'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="ticket-create__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('ticketPage.subject')">
        <t-input
          v-model="form.subject"
          :maxlength="120"
          :placeholder="t('ticketPage.subjectPlaceholder')"
        />
      </t-form-item>
      <t-form-item :label="t('ticketPage.category')" :help="t('ticketPage.categoryHint')">
        <t-select
          v-model="form.categoryId"
          :options="categoryOptions"
          clearable
          :placeholder="t('ticketPage.categoryPlaceholder')"
        />
      </t-form-item>
      <t-form-item :label="t('ticketPage.priority')">
        <t-select v-model="form.priority" :options="priorityOptions" />
      </t-form-item>
      <t-form-item :label="t('ticketPage.content')">
        <t-textarea
          v-model="form.content"
          :maxlength="5000"
          :placeholder="t('ticketPage.contentPlaceholder')"
          :autosize="{ minRows: 5, maxRows: 12 }"
        />
      </t-form-item>
      <t-form-item :label="t('ticketPage.attachments')" :help="t('ticketPage.attachmentHint')">
        <TicketAttachmentsField v-model="attachments" :disabled="submitting" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.ticket-create {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
