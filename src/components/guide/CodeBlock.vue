<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { CheckmarkCircle02Icon, Copy01Icon } from '@/icons'

/**
 * 代码块：等宽字体 + 轻量语法着色（不引入高亮库）+ 复制按钮。
 * 着色只覆盖 JS 的关键字/字符串/数字/注释，够用即可。
 */
defineOptions({ name: 'CodeBlock' })

const props = withDefaults(
  defineProps<{
    code: string
    language?: 'bash' | 'js' | 'text'
  }>(),
  { language: 'text' },
)

const { t } = useI18n()

interface Token {
  text: string
  color?: string
}

/** 语法着色用 TDesign 语义色，明暗两态自动适配 */
const CODE_COLORS = {
  comment: 'var(--td-text-color-placeholder)',
  string: 'var(--td-success-color)',
  keyword: 'var(--td-brand-color)',
  number: 'var(--td-warning-color)',
}

const tokens = computed<Token[]>(() => {
  if (props.language !== 'js') {
    return [{ text: props.code }]
  }

  // 每次重新创建正则，避免共享 lastIndex 造成的副作用
  const pattern =
    /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|await|async|function|return|new|require|module|exports|import|from)\b)/g

  const result: Token[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(props.code)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: props.code.slice(lastIndex, match.index) })
    }
    const [full, comment, str, num, keyword] = match
    result.push({
      text: full,
      color: comment
        ? CODE_COLORS.comment
        : str
          ? CODE_COLORS.string
          : keyword
            ? CODE_COLORS.keyword
            : num
              ? CODE_COLORS.number
              : undefined,
    })
    lastIndex = match.index + full.length
  }

  if (lastIndex < props.code.length) {
    result.push({ text: props.code.slice(lastIndex) })
  }
  return result
})

const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="code-block">
    <pre class="code-block__pre"><code class="code-block__code"><span
          v-for="(token, index) in tokens"
          :key="index"
          :style="token.color ? { color: token.color } : undefined"
        >{{ token.text }}</span></code></pre>

    <t-tooltip
      :content="t('guide.copy')"
      placement="top"
    >
      <button
        type="button"
        class="code-block__copy"
        :aria-label="t('guide.copy')"
        @click="copyCode"
      >
        <AppIcon
          :icon="copied ? CheckmarkCircle02Icon : Copy01Icon"
          :size="16"
        />
      </button>
    </t-tooltip>
  </div>
</template>

<style scoped lang="less">
.code-block {
  position: relative;
  padding: 12px 40px 12px 16px;
  background-color: @beacon-bg-page;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &__pre {
    margin: 0;
    overflow-x: auto;
  }

  &__code {
    font-family: menlo, consolas, 'dejavu sans mono', monospace;
    font-size: 13px;
    line-height: 20px;
    color: @beacon-text-primary;
    white-space: pre;
  }

  &__copy {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }
}
</style>
