<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createNotificationChannel, updateNotificationChannel } from '@/api'
import type { NotificationChannel, NotificationChannelType } from '@/api/types/notification'
import {
  CHANNEL_TYPES,
  isWebhookChannelType,
  parseListInput,
  readConfigString,
  readConfigStringList,
} from '@/utils/channel-presenter'

/**
 * 通知渠道编辑器：按渠道类型切换配置字段。
 * 后端按 type 校验 config，前端只做必填与格式校验后原样提交。
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; channel?: NotificationChannel }>()
const emit = defineEmits<{ saved: [channel: NotificationChannel] }>()
const { t } = useI18n()

const submitting = ref(false)
const error = ref('')
let generation = 0

const form = reactive({
  type: 'FEISHU' as NotificationChannelType,
  name: '',
  enabled: true,
  webhookUrl: '',
  secret: '',
  appId: '',
  appSecret: '',
  templateId: '',
  openIds: '',
  page: '',
  recipients: '',
})

const typeOptions = computed(() =>
  CHANNEL_TYPES.map((type) => ({ label: t(`channelPage.type.${type}`), value: type })),
)
const isWebhook = computed(() => isWebhookChannelType(form.type))
const webhookPlaceholder = computed(() => t(`channelPage.webhookPlaceholder.${form.type}`))

/** 按当前类型组装 config（空的可选字段不提交） */
function buildConfig(): Record<string, unknown> {
  if (isWebhookChannelType(form.type)) {
    const secret = form.secret.trim()
    return { webhookUrl: form.webhookUrl.trim(), ...(secret ? { secret } : {}) }
  }
  if (form.type === 'WECHAT_SUBSCRIBE') {
    const page = form.page.trim()
    return {
      appId: form.appId.trim(),
      appSecret: form.appSecret.trim(),
      templateId: form.templateId.trim(),
      openIds: parseListInput(form.openIds),
      ...(page ? { page } : {}),
    }
  }
  return { to: parseListInput(form.recipients) }
}

function validate(): string {
  if (!form.name.trim()) return t('channelPage.required')
  if (isWebhookChannelType(form.type)) {
    const url = form.webhookUrl.trim()
    if (!url) return t('channelPage.required')
    if (!/^https?:\/\//i.test(url)) return t('channelPage.invalidWebhook')
    return ''
  }
  if (form.type === 'WECHAT_SUBSCRIBE') {
    if (!form.appId.trim() || !form.appSecret.trim() || !form.templateId.trim())
      return t('channelPage.required')
    if (!parseListInput(form.openIds).length) return t('channelPage.openIdsRequired')
    return ''
  }
  const recipients = parseListInput(form.recipients)
  if (!recipients.length) return t('channelPage.recipientsRequired')
  if (!recipients.every((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))
    return t('channelPage.invalidRecipients')
  return ''
}

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    const channel = props.channel
    Object.assign(form, {
      type: channel?.type ?? 'FEISHU',
      name: channel?.name ?? '',
      enabled: channel?.enabled ?? true,
      webhookUrl: readConfigString(channel?.config, 'webhookUrl'),
      secret: readConfigString(channel?.config, 'secret'),
      appId: readConfigString(channel?.config, 'appId'),
      appSecret: readConfigString(channel?.config, 'appSecret'),
      templateId: readConfigString(channel?.config, 'templateId'),
      openIds: readConfigStringList(channel?.config, 'openIds').join('\n'),
      page: readConfigString(channel?.config, 'page'),
      recipients: readConfigStringList(channel?.config, 'to').join('\n'),
    })
  },
  { flush: 'sync' },
)
// 切换团队或切换编辑对象时关闭弹窗，避免把上一个渠道的配置提交到新作用域
watch(
  () => [props.orgId, props.channel?.id],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

async function save() {
  if (submitting.value) return
  error.value = validate()
  if (error.value) return
  const orgId = props.orgId
  const editing = props.channel?.id
  const token = generation
  submitting.value = true
  try {
    const payload = {
      type: form.type,
      name: form.name.trim(),
      config: buildConfig(),
      enabled: form.enabled,
    }
    const result = editing
      ? await updateNotificationChannel(orgId, editing, payload)
      : await createNotificationChannel(orgId, payload)
    if (token !== generation) return
    MessagePlugin.success(t(editing ? 'channelPage.updated' : 'channelPage.created'))
    visible.value = false
    emit('saved', result)
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('channelPage.saveFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(channel ? 'channelPage.editTitle' : 'channelPage.createTitle')"
    width="min(560px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="save"
  >
    <t-alert v-if="error" theme="error" :message="error" class="editor-error" />
    <t-form :data="form" label-align="top" :colon="false">
      <t-form-item :label="t('channelPage.name')"
        ><t-input v-model="form.name" :maxlength="100"
      /></t-form-item>
      <t-form-item :label="t('channelPage.typeLabel')">
        <t-select v-model="form.type" :options="typeOptions" />
      </t-form-item>

      <template v-if="isWebhook">
        <t-form-item :label="t('channelPage.webhookUrl')"
          ><t-input
            v-model="form.webhookUrl"
            :maxlength="2048"
            :placeholder="webhookPlaceholder"
        /></t-form-item>
        <t-form-item :label="t('channelPage.secret')"
          ><t-input
            v-model="form.secret"
            type="password"
            :maxlength="256"
            :placeholder="t('channelPage.secretPlaceholder')"
        /></t-form-item>
      </template>

      <template v-else-if="form.type === 'WECHAT_SUBSCRIBE'">
        <t-form-item :label="t('channelPage.appId')"
          ><t-input v-model="form.appId" :maxlength="128"
        /></t-form-item>
        <t-form-item :label="t('channelPage.appSecret')"
          ><t-input v-model="form.appSecret" type="password" :maxlength="256"
        /></t-form-item>
        <t-form-item :label="t('channelPage.templateId')"
          ><t-input v-model="form.templateId" :maxlength="256"
        /></t-form-item>
        <t-form-item :label="t('channelPage.openIds')"
          ><t-textarea v-model="form.openIds" :autosize="{ minRows: 3, maxRows: 8 }"
        /></t-form-item>
        <t-form-item :label="t('channelPage.page')"
          ><t-input v-model="form.page" :maxlength="512"
        /></t-form-item>
      </template>

      <t-form-item v-else :label="t('channelPage.recipients')"
        ><t-textarea v-model="form.recipients" :autosize="{ minRows: 3, maxRows: 8 }"
      /></t-form-item>

      <t-form-item :label="t('channelPage.enabledLabel')"
        ><t-switch v-model="form.enabled"
      /></t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped>
.editor-error {
  margin-bottom: 16px;
}
</style>
