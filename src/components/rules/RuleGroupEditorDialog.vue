<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createRuleGroup, updateRuleGroup } from '@/api'
import type { RuleGroup, RuleNode } from '@/api/types/rule'
import RuleTreeEditor from '@/components/rules/RuleTreeEditor.vue'
import { useRuleMeta } from '@/composables/useRuleMeta'
import { cloneRuleTree, defaultRuleTree, validateRuleTree } from '@/utils/rule-presenter'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'

/**
 * 规则组新建 / 编辑弹窗：基本信息（名称、描述、作用范围、启用）+ 规则树编辑器。
 * 作用范围只在新建时可选——后端 UpdateRuleGroupDto 不接收 projectId。
 */
defineOptions({ name: 'RuleGroupEditorDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  orgId: string
  /** 编辑对象；为空表示新建 */
  group?: RuleGroup | null
  /** 新建时的默认范围：传当前项目则默认项目级，否则组织级 */
  projectId?: string | null
  /** 默认模板按协议选择（HTTP 用状态码 / 耗时 / 证书模板） */
  monitorType?: string | null
}>()
const emit = defineEmits<{ saved: [group: RuleGroup] }>()

const { t } = useI18n()
const permissions = usePermissionsStore()
const canOrganization = computed(() => permissions.canOrganization(props.orgId))
const canSave = computed(() => {
  const projectId = props.group?.projectId ?? (form.scope === 'project' ? props.projectId : null)
  return projectId ? permissions.canProject(projectId, 'rule.manage') : canOrganization.value
})
const { meta, error: metaError, load: loadMeta } = useRuleMeta()
const submitting = ref(false)
const error = ref('')
let generation = 0
const form = reactive({
  name: '',
  description: '',
  scope: 'org' as 'org' | 'project',
  enabled: true,
  tree: defaultRuleTree(props.monitorType) as RuleNode,
})

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    void loadMeta()
    const group = props.group
    form.name = group?.name ?? ''
    form.description = group?.description ?? ''
    form.scope = group ? (group.projectId ? 'project' : 'org') : props.projectId ? 'project' : 'org'
    form.enabled = group?.enabled ?? true
    if (group && !group.tree) {
      visible.value = false
      return
    }
    form.tree = group?.tree ? cloneRuleTree(group.tree) : defaultRuleTree(props.monitorType)
  },
  { flush: 'sync' },
)
// 切换编辑目标 / 组织时关闭弹窗，避免把上一份表单写进另一个规则组
watch(
  () => [props.orgId, props.group?.id, props.projectId, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

const editing = computed(() => Boolean(props.group?.id))
const issues = computed(() => validateRuleTree(form.tree, meta.value))
const scopeOptions = computed(() => [
  ...(canOrganization.value ? [{ label: t('ruleGroup.editor.scopeOrg'), value: 'org' }] : []),
  { label: t('ruleGroup.editor.scopeProject'), value: 'project' },
])

function resetTemplate() {
  form.tree = defaultRuleTree(props.monitorType)
}

async function save() {
  if (submitting.value || !canSave.value || (form.scope === 'org' && !canOrganization.value)) return
  error.value = ''
  const name = form.name.trim()
  if (!name) {
    error.value = t('ruleGroup.editor.invalidName')
    return
  }
  if (!meta.value) {
    error.value = metaError.value || t('ruleGroup.editor.metaPending')
    return
  }
  if (issues.value.length) {
    error.value = t('ruleGroup.editor.invalidTree')
    return
  }
  const token = generation
  const orgId = props.orgId
  const group = props.group
  const description = form.description.trim()
  submitting.value = true
  try {
    const project = group?.projectId ?? (form.scope === 'project' ? props.projectId : null)
    if (project) await permissions.ensureProject(project, true)
    else await permissions.ensureOrganization(orgId, true)
    if (token !== generation || !visible.value || !canSave.value) return
    const result = group
      ? await updateRuleGroup(orgId, group.id, {
          name,
          description,
          tree: form.tree,
          enabled: form.enabled,
        })
      : await createRuleGroup(orgId, {
          name,
          ...(description ? { description } : {}),
          ...(form.scope === 'project' && props.projectId ? { projectId: props.projectId } : {}),
          tree: form.tree,
        })
    if (token !== generation || orgId !== props.orgId) return
    MessagePlugin.success(
      t(editing.value ? 'ruleGroup.editor.updated' : 'ruleGroup.editor.created'),
    )
    visible.value = false
    emit('saved', result)
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('ruleGroup.editor.saveFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t(editing ? 'ruleGroup.editor.editTitle' : 'ruleGroup.editor.createTitle')"
    width="min(960px, calc(100vw - 32px))"
    :confirm-btn="{
      content: t('common.confirm'),
      loading: submitting,
      disabled: !meta || !canSave,
    }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="save"
  >
    <t-alert v-if="error" theme="error" :message="error" class="rule-group-editor__error" />
    <t-alert
      v-else-if="metaError && !meta"
      theme="error"
      :message="metaError"
      class="rule-group-editor__error"
    />
    <t-form :data="form" label-align="top" :colon="false">
      <div class="rule-group-editor__grid">
        <t-form-item :label="t('ruleGroup.editor.name')"
          ><t-input
            v-model="form.name"
            :maxlength="100"
            :placeholder="t('ruleGroup.editor.namePlaceholder')"
        /></t-form-item>
        <t-form-item :label="t('ruleGroup.editor.scope')">
          <t-select v-if="!editing" v-model="form.scope" :options="scopeOptions" />
          <t-input
            v-else
            readonly
            :value="
              form.scope === 'project'
                ? t('ruleGroup.editor.scopeProject')
                : t('ruleGroup.editor.scopeOrg')
            "
          />
        </t-form-item>
      </div>
      <t-form-item :label="t('ruleGroup.editor.description')"
        ><t-textarea
          v-model="form.description"
          :maxlength="200"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('ruleGroup.editor.descriptionPlaceholder')"
      /></t-form-item>
      <t-form-item v-if="editing" :label="t('ruleGroup.editor.enabled')"
        ><t-switch v-model="form.enabled"
      /></t-form-item>
    </t-form>
    <div class="rule-group-editor__section">
      <div class="rule-group-editor__section-head">
        <span class="rule-group-editor__section-title">{{ t('ruleGroup.editor.treeTitle') }}</span>
        <t-button size="small" variant="outline" :disabled="!meta" @click="resetTemplate">{{
          t('ruleGroup.editor.resetTemplate')
        }}</t-button>
      </div>
      <p class="rule-group-editor__hint">{{ t('ruleGroup.editor.treeHint') }}</p>
      <RuleTreeEditor v-model="form.tree" :meta="meta" />
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.rule-group-editor {
  &__error {
    margin-bottom: 16px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid @beacon-border;
  }

  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__section-title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .rule-group-editor__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
