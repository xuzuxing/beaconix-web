<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CreateProjectParams, Project } from '@/api/types'
import { useOrganizationStore } from '@/stores'

/**
 * 新建项目：填写名称、标识（组织内唯一的大写短码）与描述。
 * 创建成功后由顶栏刷新项目列表并切到新项目。
 */
defineOptions({ name: 'ProjectCreateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [project: Project] }>()
const { t } = useI18n()
const orgStore = useOrganizationStore()

const form = reactive({ name: '', key: '', description: '' })
/** 标识一旦被手动改过，就不再跟随名称自动生成 */
const keyTouched = ref(false)
const submitting = ref(false)
const error = ref('')
let generation = 0

/** 由名称推导短码：只保留大写字母与数字，并截到接口允许的 10 位 */
function deriveKey(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10)
}

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    keyTouched.value = false
    if (!value) return
    Object.assign(form, { name: '', key: '', description: '' })
  },
  { flush: 'sync' },
)

// 名称变化时自动生成标识（不足 2 位时留空，交给用户手填）
watch(
  () => form.name,
  (name) => {
    if (keyTouched.value) return
    const derived = deriveKey(name)
    form.key = derived.length >= 2 ? derived : ''
  },
)

function validate(): string {
  if (!form.name.trim()) return t('workspace.project.nameRequired')
  if (!form.key.trim()) return t('workspace.project.keyRequired')
  if (!/^[A-Z0-9]{2,10}$/.test(form.key.trim()))
    return t('workspace.project.keyInvalid')
  return ''
}

async function submit() {
  if (submitting.value) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }

  const payload: CreateProjectParams = {
    name: form.name.trim(),
    key: form.key.trim(),
  }
  if (form.description.trim()) payload.description = form.description.trim()

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const project = await orgStore.createProject(payload)
    if (token !== generation) return
    MessagePlugin.success(t('workspace.project.created'))
    visible.value = false
    emit('created', project)
  } catch (cause) {
    if (token === generation)
      error.value =
        cause instanceof Error
          ? cause.message
          : t('workspace.project.createFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.project.create')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert
      v-if="error"
      theme="error"
      :message="error"
      class="project-create__error"
    />

    <t-form
      label-align="top"
      :colon="false"
      :data="form"
    >
      <t-form-item :label="t('workspace.project.name')">
        <t-input
          v-model="form.name"
          :maxlength="100"
          :placeholder="t('workspace.project.namePlaceholder')"
        />
      </t-form-item>
      <t-form-item
        :label="t('workspace.project.key')"
        :help="t('workspace.project.keyHint')"
      >
        <t-input
          v-model="form.key"
          :maxlength="10"
          :placeholder="t('workspace.project.keyPlaceholder')"
          @change="keyTouched = true"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.project.description')">
        <t-textarea
          v-model="form.description"
          :maxlength="500"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('workspace.project.descriptionPlaceholder')"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.project-create {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
