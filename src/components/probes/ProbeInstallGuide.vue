<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { CheckmarkCircle02Icon, CodeIcon, Copy01Icon } from '@/icons'

const { t } = useI18n()
const installCommand =
  'curl -fsSL https://get.beaconix.app/install.sh | sudo sh'
const copied = ref(false)

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(installCommand)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section
    class="probe-install"
    :aria-label="t('probePage.installGuide.title')"
  >
    <h3><AppIcon :icon="CodeIcon" />{{ t('probePage.installGuide.title') }}</h3>
    <div class="probe-install__command">
      <span>{{ t('probePage.installGuide.scriptUrl') }}</span>
      <div class="probe-install__input">
        <code>{{ installCommand }}</code>
        <t-tooltip
          :content="t('probePage.installGuide.copy')"
          placement="top"
        >
          <button
            type="button"
            class="probe-install__copy"
            :aria-label="t('probePage.installGuide.copy')"
            @click="copyCommand"
          >
            <AppIcon
              :icon="copied ? CheckmarkCircle02Icon : Copy01Icon"
              :size="16"
            />
          </button>
        </t-tooltip>
      </div>
    </div>
    <ul>
      <li
        v-for="note in ['requirements', 'enrollment', 'connect']"
        :key="note"
      >
        {{ t(`probePage.installGuide.${note}`) }}
      </li>
    </ul>
  </section>
</template>

<style scoped lang="less">
.probe-install {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid @beacon-border;

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
  }

  &__command {
    display: grid;
    gap: 6px;
    min-width: 0;

    > span {
      color: @beacon-text-secondary;
      font-size: 13px;
    }
  }

  // 只读输入框样式：等宽命令 + 右侧复制按钮，宽度贴合命令长度
  &__input {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    height: 32px;
    padding: 0 4px 0 12px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;

    code {
      flex: 0 1 auto;
      min-width: 0;
      overflow-x: auto;
      font-family: @beacon-font-family-code;
      font-size: 12px;
      color: @beacon-text-primary;
      white-space: nowrap;
      scrollbar-width: thin;
    }
  }

  &__copy {
    display: inline-flex;
    flex: none;
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

  ul {
    display: grid;
    gap: 4px;
    padding-left: 18px;
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
}
</style>
