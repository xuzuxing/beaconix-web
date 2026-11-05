<script setup lang="ts">
/** RUM 列表分页：统一右对齐 + 与内容区留出上间距 */
defineOptions({ name: 'RumPager' })

const page = defineModel<number>({ required: true })
defineProps<{ total: number; limit: number }>()
</script>

<template>
  <t-pagination
    v-model:current="page"
    class="rum-pager"
    :total="total"
    :page-size="limit"
    :show-page-size="false"
    :show-jumper="false"
  />
</template>

<style scoped lang="less">
.rum-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: @beacon-gap-l;
}
</style>
