<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createOrganization } from '@/api'
import type { CreateOrganizationParams, Organization } from '@/api/types'

/**
 * 新建团队：提交名称与标识（可选简介 / 官网 / Logo）创建组织，
 * 创建者自动成为 OWNER；成功后由页面切到新团队并进入控制台。
 */
defineOptions({ name: 'TeamCreateDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [org: Organization] }>()
const { t } = useI18n()

const form = reactive({ name: '', slug: '', description: '', website: '', logoUrl: '' })
/** 标识一旦被手动改过，就不再跟随名称自动生成 */
const slugTouched = ref(false)
const submitting = ref(false)
const error = ref('')
let generation = 0

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    slugTouched.value = false
    if (!value) return
    Object.assign(form, { name: '', slug: '', description: '', website: '', logoUrl: '' })
  },
  { flush: 'sync' },
)

// 名称变化时自动生成标识（只取小写字母、数字与连字符）
watch(
  () => form.name,
  (name) => {
    if (slugTouched.value) return
    form.slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  },
)

function validate(): string {
  if (!form.name.trim() || !form.slug.trim()) return t('workspace.team.required')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) return t('workspace.team.slugInvalid')
  const website = form.website.trim()
  if (website && !/^https?:\/\//i.test(website)) return t('workspace.team.websiteInvalid')
  return ''
}

async function submit() {
  if (submitting.value) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }

  const payload: CreateOrganizationParams = {
    name: form.name.trim(),
    slug: form.slug.trim(),
  }
  if (form.description.trim()) payload.description = form.description.trim()
  if (form.website.trim()) payload.website = form.website.trim()
  if (form.logoUrl.trim()) payload.logoUrl = form.logoUrl.trim()

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const org = await createOrganization(payload)
    if (token !== generation) return
    MessagePlugin.success(t('workspace.team.created'))
    visible.value = false
    emit('created', org)
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.team.createFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.team.create')"
    width="min(520px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="team-create__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('workspace.team.name')">
        <t-input v-model="form.name" :maxlength="100" :placeholder="t('workspace.team.namePlaceholder')" />
      </t-form-item>
      <t-form-item :label="t('workspace.team.slug')" :help="t('workspace.team.slugHint')">
        <t-input
          v-model="form.slug"
          :maxlength="50"
          :placeholder="t('workspace.team.slugPlaceholder')"
          @change="slugTouched = true"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.team.description')">
        <t-textarea
          v-model="form.description"
          :maxlength="500"
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.team.website')">
        <t-input
          v-model="form.website"
          :maxlength="200"
          :placeholder="t('workspace.team.websitePlaceholder')"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.team.logoUrl')">
        <t-input
          v-model="form.logoUrl"
          :maxlength="500"
          :placeholder="t('workspace.team.logoUrlPlaceholder')"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.team-create {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
