<script setup lang="ts">
const page = defineModel<number>({ required: true })
defineProps<{ total: number; limit: number }>()
</script>
<template>
  <t-pagination
    class="rum-pager"
    v-model:current="page"
    :total="total"
    :page-size="limit"
    :show-page-size="false"
    :show-jumper="false"
  />
</template>
<style scoped>
.rum-pager {
  display: flex;
  align-items: center;
  margin-top: 16px;
}
</style>
