import { onActivated } from 'vue'

/**
 * keep-alive 页面重新激活时重新拉取列表数据。
 *
 * 主布局默认缓存页面（见 layouts/components/AppContent.vue），缓存期间从别的页面
 * （详情页、个人中心、另一个列表）返回不会重新执行 setup，列表会停留在离开时的数据。
 * 首次激活与挂载是同一时机，数据已由各页自己的 watch(immediate) / onMounted 拉取，
 * 因此跳过第一次，避免重复请求。
 *
 * 非 keep-alive 的页面（meta.keepAlive === false）不会触发 onActivated，行为不变。
 */
export function useRefreshOnActivate(refresh: () => unknown) {
  let first = true
  onActivated(() => {
    if (first) {
      first = false
      return
    }
    void refresh()
  })
}
