<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createStatusPage, updateStatusPage } from '@/api'
import type { StatusPage } from '@/api/types/status-page'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'
import { useOrganizationMonitors } from '@/composables/useOrganizationMonitors'
import {
  isValidStatusPageSlug,
  publicStatusPageUrl,
  type StatusPageTemplate,
} from '@/utils/status-page-presenter'

/**
 * 状态页编辑器：标题、slug、描述、可见监控项与两个展示开关。
 * 用模板创建时（props.template）只把模板的展示开关作为初值，不写库。
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  orgId: string
  page?: StatusPage
  /** 来自「页面模板」页的预设，仅新建时生效 */
  template?: StatusPageTemplate
}>()
const emit = defineEmits<{ saved: [page: StatusPage] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()

const submitting = ref(false)
const error = ref('')
let generation = 0

/** 只有对话框打开时才加载可选监控项：避免页面一进入就发起跨项目请求 */
const monitorScope = computed(() =>
  visible.value && permissions.canOrganization(props.orgId)
    ? props.orgId
    : undefined,
)
const {
  monitors,
  loading: monitorsLoading,
  error: monitorsError,
  load: reloadMonitors,
} = useOrganizationMonitors(monitorScope)
const monitorOptions = computed(() =>
  monitors.value.map((monitor) => ({
    label: `${monitor.projectName} · ${monitor.name}`,
    value: monitor.id,
  })),
)

const form = reactive({
  title: '',
  slug: '',
  description: '',
  visibleMonitorIds: [] as string[],
  showLatency: true,
  showUptime: false,
  enabled: true,
})

/** 编辑态下展示当前公开地址，便于确认分享链接 */
const publicUrl = computed(() =>
  props.page?.slug ? publicStatusPageUrl(props.page.slug) : '',
)
const templateName = computed(() =>
  props.template ? t(`statusPage.template.${props.template.id}.name`) : '',
)

function validate(): string {
  if (!form.title.trim()) return t('statusPage.required')
  const slug = form.slug.trim()
  if (slug && !isValidStatusPageSlug(slug)) return t('statusPage.invalidSlug')
  return ''
}

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    const page = props.page
    const template = props.template
    Object.assign(form, {
      title: page?.title ?? '',
      slug: page?.slug ?? '',
      description: page?.description ?? '',
      visibleMonitorIds: page ? [...page.visibleMonitorIds] : [],
      showLatency: page?.showLatency ?? template?.showLatency ?? true,
      showUptime: page?.showUptime ?? template?.showUptime ?? false,
      enabled: page?.enabled ?? true,
    })
  },
  { flush: 'sync' },
)
// 切换团队或切换编辑对象时关闭弹窗，避免把上一个状态页的配置提交到新作用域
watch(
  () => [props.orgId, props.page?.id, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

async function save() {
  if (submitting.value || !permissions.canOrganization(props.orgId)) return
  error.value = validate()
  if (error.value) return
  const orgId = props.orgId
  const editing = props.page?.id
  const token = generation
  submitting.value = true
  try {
    await permissions.ensureOrganization(orgId, true)
    if (
      token !== generation ||
      !visible.value ||
      !permissions.canOrganization(orgId)
    )
      return
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      visibleMonitorIds: [...form.visibleMonitorIds],
      showLatency: form.showLatency,
      showUptime: form.showUptime,
      enabled: form.enabled,
    }
    const result = editing
      ? await updateStatusPage(orgId, editing, payload)
      : await createStatusPage(orgId, payload)
    if (token !== generation) return
    MessagePlugin.success(
      t(editing ? 'statusPage.updated' : 'statusPage.created'),
    )
    visible.value = false
    emit('saved', result)
  } catch (cause) {
    if (token === generation)
      error.value =
        cause instanceof Error ? cause.message : t('statusPage.saveFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(page ? 'statusPage.editTitle' : 'statusPage.createTitle')"
    width="min(620px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="save"
  >
    <t-alert
      v-if="error"
      theme="error"
      :message="error"
      class="editor-error"
    />
    <t-alert
      v-if="!page && templateName"
      theme="info"
      :message="t('statusPage.templateApplied', { name: templateName })"
      class="editor-error"
    />

    <t-form
      :data="form"
      label-align="top"
      :colon="false"
    >
      <t-form-item :label="t('statusPage.titleLabel')"
        ><t-input
          v-model="form.title"
          :maxlength="100"
          :placeholder="t('statusPage.titlePlaceholder')"
      /></t-form-item>
      <t-form-item :label="t('statusPage.slugLabel')"
        ><t-input
          v-model="form.slug"
          :maxlength="64"
          :placeholder="t('statusPage.slugPlaceholder')"
      /></t-form-item>
      <t-form-item :label="t('statusPage.descriptionLabel')"
        ><t-textarea
          v-model="form.description"
          :maxlength="500"
          :autosize="{ minRows: 2, maxRows: 6 }"
          :placeholder="t('statusPage.descriptionPlaceholder')"
      /></t-form-item>

      <t-form-item :label="t('statusPage.monitorsLabel')">
        <div class="editor-monitors">
          <t-select
            v-model="form.visibleMonitorIds"
            multiple
            filterable
            clearable
            :loading="monitorsLoading"
            :options="monitorOptions"
            :placeholder="t('statusPage.monitorsPlaceholder')"
          />
          <p class="editor-monitors__hint">
            <template v-if="monitorsError">
              {{ monitorsError }}
              <t-button
                variant="text"
                size="small"
                @click="reloadMonitors"
                >{{ t('statusPage.retry') }}</t-button
              >
            </template>
            <template v-else>{{ t('statusPage.monitorsHint') }}</template>
          </p>
        </div>
      </t-form-item>

      <t-form-item :label="t('statusPage.displayLabel')">
        <div class="editor-switches">
          <t-checkbox v-model="form.showUptime">{{
            t('statusPage.showUptime')
          }}</t-checkbox>
          <t-checkbox v-model="form.showLatency">{{
            t('statusPage.showLatency')
          }}</t-checkbox>
          <t-checkbox v-model="form.enabled">{{
            t('statusPage.enabledLabel')
          }}</t-checkbox>
        </div>
      </t-form-item>

      <t-form-item
        v-if="publicUrl"
        :label="t('statusPage.publicUrl')"
      >
        <span class="editor-url">{{ publicUrl }}</span>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.editor-error {
  margin-bottom: 16px;
}

.editor-monitors {
  width: 100%;

  &__hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: @beacon-text-secondary;
  }
}

.editor-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 0 24px;
}

.editor-url {
  font-size: 13px;
  color: @beacon-text-secondary;
  overflow-wrap: anywhere;
}
</style>
