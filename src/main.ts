import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next'

import App from './App.vue'
import { setupI18n } from './locales'
import router from './router'
import { pinia, useUserStore } from './stores'
import { setupRequestUnauthorized, setupRequestToken } from './utils/request'

import 'tdesign-vue-next/es/style/index.css'
import '@/assets/styles/index.less'
// 全局路由守卫（挂在已创建的 router 上，作用时机在每次导航）
import './permission'

const app = createApp(App)

app.use(pinia)
app.use(TDesign)
app.use(router)

// i18n 的初始语言取自 pinia 中的持久化状态，需在 pinia 安装之后创建
setupI18n(app)

// 请求层与 store 解耦：token 与 401 处理在这里接线
setupRequestToken(() => useUserStore().token)
setupRequestUnauthorized(() => {
  useUserStore().reset()
  void router.replace({
    path: '/login',
    query: { redirect: router.currentRoute.value.fullPath },
  })
})

app.mount('#app')
