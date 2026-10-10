<script setup lang="ts">
/**
 * 主布局的内容区：默认对页面做 keep-alive 缓存，
 * 路由 meta.keepAlive === false 的页面则不缓存。
 */
defineOptions({ name: 'AppContent' })
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <transition name="fade" mode="out-in">
      <keep-alive v-if="route.meta.keepAlive !== false">
        <component :is="Component" />
      </keep-alive>
      <component :is="Component" v-else />
    </transition>
  </router-view>
</template>
