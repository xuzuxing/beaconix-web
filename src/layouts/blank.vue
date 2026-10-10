<script setup lang="ts">
/**
 * 空白布局：整屏无侧边菜单与顶部栏，
 * 用于 404、登录页等不需要框架的页面。
 */
defineOptions({ name: 'BlankLayout' })
</script>

<template>
  <div class="blank-layout">
    <router-view />
  </div>
</template>

<style scoped lang="less">
.blank-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}
</style>
