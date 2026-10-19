<script setup lang="ts">
import { useBrand } from '@/composables/useBrand'

/**
 * 站点页脚：展示平台配置的版权文案与 ICP 备案号（`system.footerCopyright` /
 * `system.icpLicense`）。两项都为空时不渲染，避免留一条空页脚。
 */
defineOptions({ name: 'AppFooter' })

const { footerCopyright, icpLicense } = useBrand()
</script>

<template>
  <footer
    v-if="footerCopyright || icpLicense"
    class="app-footer"
  >
    <span
      v-if="footerCopyright"
      class="app-footer__copy"
      >{{ footerCopyright }}</span
    >
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
