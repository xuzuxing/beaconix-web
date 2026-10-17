<script setup lang="ts">
import { useBrand } from '@/composables/useBrand'

/**
 * 站点页脚：展示平台配置的版权文案与 ICP 备案号（`system.footerCopyright` /
 * `system.icpLicense`）。两项都为空时不渲染，避免留一条空页脚。
 */
defineOptions({ name: 'AppFooter' })

const { footerCopyright, icpLicense } = useBrand()

/** 备案号按惯例链接到工信部备案系统 */
const ICP_HREF = 'https://beian.miit.gov.cn/'
</script>

<template>
  <footer v-if="footerCopyright || icpLicense" class="app-footer">
    <span v-if="footerCopyright" class="app-footer__copy">{{ footerCopyright }}</span>
    <a
      v-if="icpLicense"
      class="app-footer__icp"
      :href="ICP_HREF"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ icpLicense }}
    </a>
  </footer>
</template>

<style scoped lang="less">
.app-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: @beacon-font-size-caption;
  color: @beacon-text-tertiary;
}

.app-footer__icp {
  color: inherit;
  text-decoration: none;

  &:hover {
    color: @beacon-brand;
  }
}
</style>
