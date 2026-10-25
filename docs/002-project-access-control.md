# 002：项目访问控制前端配套规划

## 0. 状态与可行性结论

- 编写日期：2026-10-12；更新日期：2026-10-13；版本：v2，对齐后端设计 v2 及实际源码契约。
- 状态：DONE（前端代码全量实施 + 本地隔离验收）；真实后端联调与部署尚未执行。
- 前端：`D:/WorkSpace/beacon-web`，实施基于 `e33e9137f5eb44caecbfab756a7caec22f86e951` 的未提交工作区。`29740bd` 是原始规划历史基线。
- 后端契约基准：`D:/WorkSpace/beacon/advisor-plans/002-project-access-control.md`，2026-10-12 v2；实施工作区基于 `7e2e733`，此前 `04e9253` 为设计评估历史基线。
- 原始材料：`C:/Users/Admin/Downloads/002-project-access-control.md`；以修订后的后端方案为契约基准，不覆盖下载原稿。
- 前端已有用户修改：`.env.development`、`pnpm-lock.yaml`。本文编写时未读取环境变量值，也未修改、回退这些文件。
- 优先级 P1；工作量 L；风险 HIGH，主要是访问语义收紧、旧缓存与异步响应，而非页面绘制。
- 用户已授权全量实施现有前端业务的项目访问控制。本轮修改前端源码、测试和文档，不修改后端源码/schema/迁移，不执行真实业务调用或数据库操作。

**结论：技术上可行，适合在现有 Vue 3 + Pinia + TDesign 上增量实现；不需要更换框架或引入动态权限引擎。**

不能只给邀请弹窗加项目选择框。必须同时改造权限来源、团队/项目切换、菜单和路由、监控及规则操作、通知和缓存，否则后端收紧后会出现普通成员角色查询失败、局部管理员按钮缺失、无权订阅查询打断工作区、撤权后旧页面继续展示等问题。

本仓库实际是监控工作台，已有团队、监控、渠道、规则、消息中心、PAT 和平台后台。未发现任务、迭代、评论、附件业务页面或对应 API 模块；本文不借本次 ACL 扩建完整敏捷前端，相关成员候选和文件契约作为后续接入约束。

前端能力只服务交互，**不能作为安全边界**。后端仍需逐请求验证当前身份、成员关系、项目归属、能力及业务状态。当前实现、实际 wire contract 和验证结果以 [前端实施与验收记录](./002-frontend-implementation.md) 为准；下文原始源码摘录和分阶段步骤保留为历史规划，不表示当前代码仍处于原始状态。

**2026-10-12 后端实施同步：** 用户已批准后端 v2 推荐规则。授权核心、权限 API、任务/监控、缓存/ETag、私有附件、开发者 API 和通知链路已在后端工作区实现；尚未执行生产迁移、历史回填及部署验收，不代表服务已上线。当前联调以实际 Swagger/DTO 与后端 `advisor-plans/002-backend-integration.md` 为准。上述“来自设计、不代表实现”描述保留为本前端规划编写时的历史边界；前端源码本轮仍未实施。

**2026-10-13 验证同步：** 后端 123 个 Jest suites、1662 项测试和 130 项离线验收检查通过，类型检查/lint/build 通过；独立 PostgreSQL/HTTP harness 已编写，但真实数据库验收未完成，且完整数据库并发矩阵仍有待编写用例。前端保持规划状态，不因后端单测通过而标记联调或发布完成。

**2026-10-13 前端实施同步：** 已完成独立组织/项目能力、工作区与导航门禁、显式项目邀请、成员授权全量替换及双前提/409/ABA 流程、监控与规则管理、组织共享资源门禁、通知/SSE 和异步缓存清理。新增单元/组件与隔离浏览器测试。此前两条同步中的“前端未实施/保持规划状态”仅描述当时状态，不再是当前状态；本轮不分批留下 ACL 前端业务入口。

**2026-10-13 前端验收同步：** 8 个测试文件、44 项单元/组件测试与 35 项 Chromium 浏览器测试全通过，无 skipped/todo；应用/测试类型检查、oxlint、ESLint、生产构建与 diff 检查通过。桌面/平板/手机明暗主题及英文长名称截图已核查；独立复核所报问题均已修复并回归。详见实施记录，不能把这些结果等同于真实后端/数据库联调或部署。

## 1. 原始基线与适配目标（历史）

下列行号是编写时定位点，实施前必须重新核对实时源码及未提交 diff。

| 已核对位置                                                                  | 当前行为                                                                                 | 本方案的适配目标                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `D:/WorkSpace/beacon-web/package.json`                                      | Vue 3.5、Router 5、Pinia 4、Vite 8、TS 6、TDesign 1.20、Axios、Hugeicons；Node >=22.18.0 | 沿用现有技术栈、pnpm，不进行无关升级                            |
| `D:/WorkSpace/beacon-web/src/composables/useOrganizationRole.ts:28`         | 拉完整 `listMembers`，再找当前用户；失败只取消写能力                                     | 改查自己的组织能力，不能把“查询失败”解释为仍可读                |
| `D:/WorkSpace/beacon-web/src/composables/useMonitorAccess.ts`               | 直接复用组织 canManage/canCheck                                                          | 项目监控用项目能力，渠道等共享资源用组织能力                    |
| `D:/WorkSpace/beacon-web/src/components/team/MemberInviteDialog.vue:72`     | 仅发送 email + 组织 role                                                                 | 普通邀请加显式项目及逐项项目角色                                |
| `D:/WorkSpace/beacon-web/src/api/types.ts:253`                              | CreateInvitationParams 无项目授权字段                                                    | 补请求和认证邀请详情类型                                        |
| `D:/WorkSpace/beacon-web/src/api/modules/invitation.ts:35`                  | withoutToken 显式白名单映射                                                              | 新增 projects/accessMode 必须加入白名单，否则接口返回也会被丢弃 |
| `D:/WorkSpace/beacon-web/src/composables/useTeamMembers.ts`                 | canManage 为 false 仍读取完整成员列表                                                    | 未获目录读取能力时不请求；个人权限独立读取                      |
| `D:/WorkSpace/beacon-web/src/stores/modules/organization.ts:60`             | loadOrganizations 末尾等待 loadSubscription；切团队同时等待项目和订阅                    | 订阅是可选管理数据，不能影响普通成员进入团队                    |
| `D:/WorkSpace/beacon-web/src/composables/useTeamPlans.ts:25`                | 遍历团队拉订阅，失败按免费套餐显示                                                       | 未获能力不请求，未知/不可见不等于免费                           |
| `D:/WorkSpace/beacon-web/src/permission.ts:15`                              | 守卫只检查登录和 user 存在                                                               | 增加能力/工作区门禁；不能仅靠隐藏菜单                           |
| `D:/WorkSpace/beacon-web/src/router/menu.ts:40`                             | 仅按平台 globalRole 过滤菜单                                                             | 统一加入组织、项目能力条件                                      |
| `D:/WorkSpace/beacon-web/src/utils/feature-search.ts:57`                    | 功能搜索仅按平台角色过滤                                                                 | 搜索、二级导航、顶栏入口与路由同口径                            |
| `D:/WorkSpace/beacon-web/src/utils/request.ts:205`                          | 大部分错误包装为普通 Error，丢失 HTTP status                                             | 保留结构化状态用于 403/404/409 处理                             |
| `D:/WorkSpace/beacon-web/src/utils/request.ts:153`                          | 共享续期 Promise，无账号代次校验                                                         | 账号切换/退出后拒绝旧续期回写和旧请求重放                       |
| `D:/WorkSpace/beacon-web/src/layouts/components/AppContent.vue:12`          | 默认 keep-alive，无权限代次隔离                                                          | 权限失效时销毁敏感页面缓存，不能只清 store                      |
| `D:/WorkSpace/beacon-web/src/utils/monitoring-request-state.ts:16`          | 缓存按 URL/参数写入，load 本身未校验清理后的代次                                         | 清理后旧响应不能重新写入 ETag/body 缓存                         |
| `D:/WorkSpace/beacon-web/src/views/monitor/MonitorDetailView.vue:217`       | loadRules 同时拉组织规则和绑定，无请求代次保护                                           | 按能力/范围读取，加账号/项目/权限代次保护                       |
| `D:/WorkSpace/beacon-web/src/components/rules/RuleGroupEditorDialog.vue:70` | 新建可选组织级/项目级                                                                    | 项目 ADMIN 只能创建本项目规则，不能选组织模板                   |
| `D:/WorkSpace/beacon-web/src/stores/modules/notification.ts:285`            | 接受邀请后仅在 projects 为空时刷新项目                                                   | 无论旧项目列表是否为空，都失效相关授权缓存并重拉                |
| `D:/WorkSpace/beacon-web/src/api/modules/notification-center.ts`            | 已有 JWT header 的 fetch SSE，消费通知帧                                                 | 保留；当前没有专用权限变更事件契约                              |
| `D:/WorkSpace/beacon-web/src/tsconfig.app.json`                             | 排除 src/**/**tests**/*                                                                  | 新测试必须有独立类型检查入口，不能只运行转译测试                |

### 现状摘录

```typescript
// D:/WorkSpace/beacon-web/src/composables/useOrganizationRole.ts
const members = await listMembers(org.currentOrganizationId)
role.value = members.find((member) => member.userId === user.user?.id)?.role
const canManage = computed(
  () => user.isSuperAdmin || role.value === 'OWNER' || role.value === 'ADMIN',
)
const canCheck = computed(() => canManage.value || role.value === 'MEMBER')
```

该逻辑只能表达组织角色，不能表达“组织 MEMBER，A 只读、B 管理、C 不可见”。

```typescript
// D:/WorkSpace/beacon-web/src/components/team/MemberInviteDialog.vue
await sendInvitation(props.orgId, { email: form.email.trim(), role: form.role })
```

改为传 grants 之后，认证邀请列表和消息中心也要同步展示实际范围；不能让受邀者接受一份界面未展示授权范围的邀请。

### 仓库约定与验证现状

- Vue `<script setup lang="ts">`、composable + Pinia、`@/api` 统一导出；请求层通过 main.ts 注入认证 hooks，避免循环依赖。
- 前端是 **2 空格、单引号、无分号**，不是后端的 4 空格规则。
- UI 沿用 TDesign、`--td-*` / `@beacon-*`、Less、Hugeicons 的 AppIcon、HeaderActions/usePageHeader；不另引入图标库或整站新主题。
- 中英双语都补充；已有消息中心语言包独立分域，新增权限文案可以同样拆分。
- README 的请求层与持久化描述部分落后于源码：实际成功解包 `{ data, meta }`，现有核心 store 的 key 是 `beacon-vue3:*`。以源码为准，不顺带全仓重命名 storage key。
- 未发现仓库测试文件、Vitest/Playwright 配置或 test script。`team-presenter.ts` 注释提及的 `test/team-presenter.test.mjs` 当前不存在，不能作为已有测试模板。
- 本次未运行前端 type-check/build/lint，不能宣称基线已通过。后端文档记录的 59 项单测、7 处类型错误属于后端，不是前端验证结果。

## 2. 权限与产品语义

### 2.1 组织和项目必须分开

| 组织身份      | 项目范围                                       | 团队管理                    |
| ------------- | ---------------------------------------------- | --------------------------- |
| OWNER / ADMIN | 全部现有和未来项目                             | 按组织能力管理              |
| MEMBER        | 仅显式授权项目，可逐项 VIEWER / MEMBER / ADMIN | 不因项目 ADMIN 获得团队权限 |
| VIEWER        | 仅显式授权项目，有效角色始终 VIEWER            | 无团队管理权限              |

- 无 grant = 无访问，不是默认 VIEWER，更不是全部项目。
- “某项目管理员”应是组织 MEMBER + 本项目 ADMIN。
- 组织 ADMIN 不能配成“只管理几个项目”；授权抽屉不可用 projects 限制 OWNER/ADMIN。
- assignedRole 为显式记录，effectiveRole 为当前实际权限，accessMode 为继承范围。三者不可混用。
- SUPER_ADMIN 仍需后端验证当前有效平台身份和资源存在性。持久化 user.globalRole 只能用于临时界面信息，不能在权限查询失败时让所有按钮放行。
- 项目归档时正常业务写入只读；删除/恢复和特定生命周期操作用独立能力，不只比较角色高低。

### 2.2 当前工作台能力矩阵

下表为对后端 v2 的 UI 映射；实际 capability 字段名在联调阶段固定。

| 场景                               | 项目 VIEWER                | 项目 MEMBER | 项目 ADMIN           | 组织 OWNER/ADMIN           |
| ---------------------------------- | -------------------------- | ----------- | -------------------- | -------------------------- |
| 项目监控/概览/历史                 | 脱敏读取                   | 脱敏读取    | 读取，密钥不明文回显 | 读取，密钥不明文回显       |
| 手动检查                           | 不显示                     | 允许        | 允许                 | 允许                       |
| 监控新增/编辑/暂停/恢复/测试告警   | 不显示                     | 不显示      | 允许本项目           | 允许                       |
| 本项目规则与绑定                   | 只读投影                   | 只读投影    | 管理本项目规则/绑定  | 管理                       |
| 组织规则模板编辑                   | 不显示                     | 不显示      | 不显示               | 允许                       |
| 项目 ACL、团队邀请、完整成员目录   | 不显示                     | 不显示      | 不显示               | 允许，仍受目标身份规则约束 |
| 渠道完整配置/日志、探针管理        | 不显示                     | 不显示      | 不显示               | 允许                       |
| API Key、组织审计、计费/订单       | 不显示                     | 不显示      | 不显示               | 允许                       |
| 公开状态页后台管理                 | 不显示                     | 不显示      | 不显示               | 允许                       |
| 账号资料、安全、个人 PAT、本人通知 | 账号能力，与是否有项目无关 | 同左        | 同左                 | 同左                       |

隐藏写入口之外，事件处理函数也应检查最新能力；不能只使用打开弹窗时的值。仍须接受后端最终拒绝。

### 2.3 产品边界与已采用规则

前 1-6 项按已批准后端 v2 和实际实现执行；第 7 项是本轮产品范围之外。第 8 项已核对后端源码：规则列表不向非组织管理员返回组织模板全文，已有绑定允许最小摘要；归档授权保留显示且明确移除/恢复前禁止 PUT；前台重验周期为 60 秒。真实服务联调另验。

1. 组织 ADMIN 的邀请/晋升推荐仅 OWNER/当前 SUPER_ADMIN 可做；ADMIN 可管理 MEMBER/VIEWER。对已有 ADMIN 的修改/移除也需后端提供目标约束，不凭“canManage”统一放行。
2. 普通邀请必须 1-100 个项目；V1 不提供“只加入团队，无项目”邀请，但存量成员被撤销全部 grants 后可以无项目。
3. 组织 VIEWER 只能项目 VIEWER。
4. PAT 推荐只用于 `/developer/v1`，个人 scopes 不扩大项目权限。
5. 旧普通成员显式回填；缺失无项目；旧 PENDING 邀请撤销重发。
6. 已授权的在途检查/投递、已发邮件/下载内容、签名链接残留窗口不能承诺被追回。
7. VIEWER 维护本人关注的规则待确认，目前没有任务 UI，不借此扩建。
8. 项目规则候选、组织模板最小摘要、脱敏字段、归档项目 grant 的编辑规则和前端权限刷新时限需联调确认。

## 3. 接口对齐清单

API helpers 使用不含 `/api` 的路径，保持现有 baseURL 约定；下表写完整后端路径方便联调。实施时验证本地代理 rewrite 与部署前缀，不读取或改动本地 `.env` 来“修好”契约。

### 3.1 已有 API 的语义变化

| 接口                                         | 前端适配                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET `/api/organizations/:orgId/projects`     | 返回服务器已过滤项目；前端不能先全量拉取再按 grants 删除                             |
| POST `/api/organizations/:orgId/invitations` | MEMBER/VIEWER 必传 projects；ADMIN 禁止 projects                                     |
| pending / by-id / 管理邀请列表               | 认证详情增加 projects 和 accessMode；白名单保留字段但排除 token                      |
| GET `/api/invitations/:token`                | 独立 PublicInvitationPreview 类型，只用组织名、状态、登录要求；不当作完整 Invitation |
| GET `/api/organizations/:orgId/members`      | 只供有完整目录读取能力者；不再作为自身角色查询                                       |
| 组织监控概览/通知 list-detail-count          | 后端过滤授权范围，前端不能本地过滤后继续展示原 total                                 |
| 规则组列表/详情及监控 bindings               | 以实际 org/project 范围授权，并提供允许读取的投影                                    |
| 监控详情/条件请求                            | 降权后数据投影及 ETag 改变，无访问不得返回 304                                       |

认证邀请详情：

```json
{
  "accessMode": "SELECTED_PROJECTS",
  "projects": [
    { "projectId": "project-a", "projectName": "项目 A", "role": "VIEWER" },
    { "projectId": "project-b", "projectName": "项目 B", "role": "ADMIN" }
  ]
}
```

这里只展示新增字段，不是完整响应 schema。公开预览没有 projects、项目角色、发送人邮箱或项目名称，不得从历史缓存补齐这些信息。

### 3.2 后端 v2 已实施接口

| 已实施接口                                                          | 用途/限制                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GET `/api/organizations/:orgId/my-permissions`                      | 当前组织身份、能力、accessMode、成员关系代次和权限版本                    |
| GET `/api/projects/:projectId/my-permissions`                       | 当前有效项目角色及能力                                                    |
| GET `/api/organizations/:orgId/members/:userId/project-permissions` | 组织管理员或本人查询授权；GET 返回 membershipId/projectPermissionsVersion |
| PUT 同路径                                                          | 组织管理员原子替换授权；同时提交成员关系 ID 和版本                        |
| GET `/api/projects/:projectId/members`                              | 项目协作者最小字段，不暴露完整组织目录或邮箱                              |
| GET `/api/projects/:projectId/probe-options`                        | id/name/在线状态；不含凭证、目标或其他项目绑定                            |
| GET `/api/projects/:projectId/notification-channel-options`         | id/name/type；不含 webhook、secret、收件人、投递历史                      |

新增 `D:/WorkSpace/beacon-web/src/api/modules/permissions.ts` 和 `D:/WorkSpace/beacon-web/src/api/types/permissions.ts`，从现有 API barrel 导出。项目协作者 helper 可放已有 project.ts，避免复制模块。

**尚未固定的 wire schema 不得凭本文建议直接认定为后端事实。** 联调产物需记录每个能力键、字段可空性、SUPER_ADMIN 无 Membership 的响应分支、错误码/冲突分类及 DTO 校验结果。

建议前端采用独立的归一化能力视图：组织 capability 集合 + 按 projectId 索引的 capability 集合 + 读取状态。底层 DTO 到该视图由 API 层映射。未知 capability、未知角色、缺字段和接口不存在都默认拒绝，不退回旧组织角色算法。

规则候选契约已核对：继续使用服务端按当前权限过滤的规则列表；已有监控绑定中的组织模板只提供 `{ id, name, description, enabled }` 摘要。编辑器合并这些摘要供显示/解绑，不读取模板全文，也未创建不存在的 rule-options 路由。

### 3.3 邀请与授权替换请求

普通邀请：

```json
{
  "email": "colleague@example.com",
  "role": "MEMBER",
  "projects": [
    { "projectId": "project-a", "role": "VIEWER" },
    { "projectId": "project-b", "role": "ADMIN" }
  ]
}
```

组织 ADMIN 邀请只提交 email/role，**省略 projects 字段**，不是发送空数组。

授权替换：

```json
{
  "expectedMembershipId": "cmembership-current",
  "expectedVersion": 3,
  "projects": [
    { "projectId": "project-a", "role": "VIEWER" },
    { "projectId": "project-b", "role": "MEMBER" }
  ]
}
```

- grant PUT 是全量替换，不是局部 PATCH；移除、未修改和新增授权都从完整原始快照生成。
- 空数组表示撤销全部。目标为 OWNER/ADMIN 时不提交该接口，不以全选清单替代 ALL_PROJECTS。
- ID 防止离开重加后的旧页面写入；版本防止同一成员关系内并发覆盖。缺任一前提不得保存。
- GET/PUT 与邀请 schema 分别建类型：邀请普通项目不可为空，PUT 可以为空，不能共用同一个“至少一项”的验证器。
- 归档项目既有授权不得因选择器只显示 ACTIVE 而被静默丢弃。后端 v2 PUT 对 ACTIVE 的要求与保留归档 grants 的交互需先明确：支持保留/显式撤销或明确拒绝编辑；未确认前阻止保存，不过滤后提交。

## 4. 权限状态与工作区

### 4.1 单一权限来源

新增非持久化的 `D:/WorkSpace/beacon-web/src/stores/modules/permissions.ts`，让菜单、路由和业务 composable 使用同一份能力状态。不在每个组件重复查询完整成员列表。

读取状态至少区分 `idle / loading / ready / denied / error`：

- ready 才能使用该作用域 capability；loading 不闪现旧管理按钮。
- denied 清空受保护内容；error 展示可重试故障，不继续展示旧高权限内容，也不冒充“无项目”。
- 无组织、无项目、搜索无结果、已归档、无访问、网络错误是不同状态。
- 多个消费者同作用域请求去重，但响应只能提交给发起时仍有效的账号/工作区/权限代次。
- 保留 membershipId/projectPermissionsVersion；SUPER_ADMIN 无 Membership 的分支必须按后端契约表达，不能伪造 ID。

`useOrganizationRole` 可作为兼容 facade，但改用组织能力 store；其 canManage 仅用于组织管理，不再覆盖所有项目业务。`useMonitorAccess` 改为接收明确项目 ID，或由 `useProjectAccess(projectId)` 提供监控操作能力。

项目详情必须按路由 projectId 判断能力，不能用切换器暂存的另一个项目能力。组织和项目 grant 的角色排名不能替代 action、归档或资源作者约束。

### 4.2 工作区加载顺序

```text
认证有效
  -> 当前用户团队列表
  -> 校验持久化 orgId，拉当前组织自身权限
  -> 可访问项目列表
  -> 校验持久化 projectId，拉选中项目能力
  -> 挂载受保护业务内容
  -> 按已确认组织能力按需加载订阅等可选管理数据
```

- 持久化只保留选择 ID 等偏好，不持久化能力、项目列表、监控结果、邀请详情。
- 当前 `beacon-vue3:organization` 的 ID 只是待验证偏好，刷新时不能先显示上一用户项目名称。
- 账号退出、账号更换、组织更换时立即清空权限及工作区业务状态，再发新请求。
- 同组织项目切换复用有效组织状态，但项目能力、规则候选、详情/图表缓存和未提交表单按上下文隔离。
- 用户无项目时显示正常空状态，可切团队、查看本人通知/待接受邀请和账号页面；普通用户不展示“新建项目”CTA。
- 从一个可访问项目被撤权后，只能从最新已授权列表中回落选择。组织权限也消失时回团队选择页，避免 redirect 循环。
- 组织列表加载不能因订阅 403 而失败。顶栏、团队卡片、大盘未获计费读取能力时不拉订阅；未知/不可见标签隐藏或按产品决定展示“不可查看”，不能写成免费版。
- 团队卡片成员/管理按钮也按该团队的能力判断；不知道该团队能力时先隐藏，不套用当前团队能力。团队选择页可保持基础资料，无需批量读取所有团队完整订阅。

### 4.3 异步与账号代次

沿用已有 workspaceRevision、request/generation、AbortController，不另搭全局任务框架，但加入独立的账号代次与权限失效代次：

1. 请求发起时保存 sessionEpoch、workspaceRevision、permissionEpoch 和 org/project/resource ID。
2. 回写前全部比对；不匹配就丢弃，包含列表、缓存、能力、表单保存成功提示及后续绑定请求。
3. 清理时先递增代次、取消请求/定时器、清内容，再重拉。
4. token 续期读取 refreshToken 后绑定账号代次；已退出/换账号时旧续期不可 setTokens、不可继续重放原请求。
5. 401 后只续期一次；续期成功后业务重放收到 403/404/409 时按业务错误处理，不误判为续期失败登出。
6. 未获得最终提交响应时，不因网络超时断言“服务器未保存”；明确结果未知并读取服务器状态。请求取消也不能承诺撤回已提交写入。

## 5. 邀请与成员授权界面

### 5.1 邀请弹窗

改造 `D:/WorkSpace/beacon-web/src/components/team/MemberInviteDialog.vue`：

- 邮箱 + 组织身份 + 项目选择表。项目行显示名称/key、勾选、项目角色 select；搜索仅筛选候选，不改变已选授权。
- MEMBER 默认角色，项目默认一个也不选，不默认全选；勾选项目默认 VIEWER，用户明确改成 MEMBER/ADMIN。
- MEMBER/VIEWER 选 1-100 项，拒绝重复和跨团队项目；候选由当前管理员可读的 ACTIVE 项目产生。
- VIEWER 项目角色固定 VIEWER。切换到 VIEWER 前若有写角色，提示并降为 VIEWER；切回 MEMBER 不恢复历史写权限。
- 切换到组织 ADMIN 后清除项目草稿，显示“全部现有及未来项目”和团队管理风险确认，提交前检查授予 ADMIN 的能力。
- 切回普通身份时重新选择，不暗中恢复高权限草稿。当前操作者失权、团队变更或账号切换立即关闭/禁用并清空。
- 列表请求失败时不能发送；普通身份无 ACTIVE 项目时解释无法发此类邀请，不绕过至少一项规则。
- email 重复检测只是 UX，后端 409 为最终判断；已入团队应转到成员项目授权，不重复邀请。
- 发送成功刷新当前团队邀请列表；失败不触发单独 grants PUT 或“先入团队再补项目”的多请求流程。

### 5.2 成员项目授权抽屉

在 `D:/WorkSpace/beacon-web/src/views/team/TeamMembersView.vue` 的 MEMBER/VIEWER 行增加“项目权限”操作，新增 `D:/WorkSpace/beacon-web/src/components/team/MemberProjectPermissionsDrawer.vue`：

1. 有管理授权能力且允许操作该目标才显示编辑；本人读取可复用展示逻辑，但不能因“本人”变成可编辑。
2. 打开后 GET 保存 orgId/userId/membershipId/version、组织角色、完整 grants 快照。
3. 显示 assignedRole/effectiveRole；OWNER/ADMIN 显示 ALL_PROJECTS，不提供可误导的逐项目编辑。
4. 编辑前后差异摘要覆盖新增、移除、角色升降；撤销全部要二次确认。
5. 保存前重新检查上下文/能力，PUT 同时提交 expectedMembershipId/expectedVersion。
6. 成功以后端结果为准或重读，刷新相关成员列表；目标是当前用户时还需失效自身能力和当前工作区。
7. 409 锁定旧草稿保存入口并重新 GET，展示最新状态与旧草稿差异，要求用户重新确认；**禁止仅替换 ID/版本后自动提交旧 projects**。
8. Membership ID 变化表示离开重加，旧草稿作废，重新打开编辑；同代次版本冲突也不无提示合并。
9. 404 表示目标不再可用，关闭编辑并刷新目录；网络失败保留本次内存草稿供核对，不持久化。

组织角色修改与项目 grants 修改是不同流程，不宣称两条 API 原子完成。ADMIN 降为普通成员可能立刻无项目，VIEWER 降级会降低 grants，晋升不恢复旧写权限；提交角色变更前展示影响，成功后重读授权。第二步失败不得报“角色和项目权限全部保存成功”。

### 5.3 邀请详情与接受

- 管理端待处理邀请显示组织身份、accessMode、固定项目/角色。授权不可在线修改，改授权须撤销重发。
- `withoutToken` 保留认证允许的 projects/accessMode，不使用对象 spread 引回 token 或内部发起者代次。
- 消息抽屉/列表/详情和 PendingInvitations 同一口径，接受前查看最新详情、状态和失效时间。
- 发起者失权、项目归档/删除、旧邀请失效、成员额度冲突收到 409：重读状态，提示需要联系管理员，不自动反复接受。
- 接受成功始终刷新组织能力、可访问项目与相关邀请/通知，不只判断 projects.length；保留用户当前团队选择，必要时给出明确进入新团队动作。
- 新增公开邀请落地页时放在独立布局，例如 `/invitations/:token`，这是拟新增前端路由。未登录只展示最小预览，登录后才查认证详情。
- 公开页按需匿名请求，不注入旧账号凭据；token 不写 Pinia、localStorage、搜索历史、日志或分析事件，避免通过外链 referrer 泄露。登录回跳只允许站内路径，接受后用 replace 清除 token 路径。
- 直接进入登录页清认证的现有行为需与邀请回跳实测；本方案仅调整状态清理和回跳，不重构登录/2FA 产品流程。

## 6. 导航、路由与业务能力接入

### 6.1 一个判定同时服务四类入口

建议新增固定的 route meta 需求：作用域 account/organization/project/platform、需要的 capability、项目 ID 来源。字段名是前端建议，实施时补 `D:/WorkSpace/beacon-web/src/types/router.d.ts`。

统一判定函数用于 permission.ts、buildMenu、SecondaryNav、功能搜索以及顶栏/TeamCard 入口。不要给菜单、搜索和路由各写一套角色表。

- 平台 routes 的 meta.roles 不仅过滤菜单，还应在守卫验证；当前守卫没有该检查。
- 组织管理页进入前确认 capability，不先挂载组件发无权成员/渠道/账单请求。
- 项目业务路由要求可读，按钮另按 action；无项目时允许显示业务空壳，不发 `projectId=''` 请求。
- 详情路由的 projectId 优先于持久化选择，使用授权查询获得真实归属；不能遍历全组织对象寻找无权资源。
- 如果能力 API 不能提供详情所属 orgId，保留当前服务器授权 getMonitor -> 列表验证方式，并加账号/权限代次防护，不自行推断归属。
- 顶栏切团队时若仍停留旧项目详情，离开详情到该团队安全列表；同一路由更新上下文必须重新检查能力。
- 403/404 页使用“资源不可用或无访问权限”类中性信息，不展示缓存中的无权项目名、目标或团队成员。

### 6.2 监控、规则及共享基础设施

- 监控列表/详情：canRead/canCheck/canManage 按明确 projectId 取得；项目 MEMBER 可手动检查但不能测试告警，项目 ADMIN 可配置监控但不能操作渠道完整配置。
- `MonitorActions`、useMonitorActions 和弹窗保存入口都复验当前能力，失权关闭编辑器、规则抽屉和 Teleport 动作区。
- 数据模型接受后端脱敏投影，不能把缺失 target/config 解释为“空配置”后编辑提交。必要时拆 readonly summary 与管理编辑 DTO，不靠 any 绕过类型。
- 保留凭据“不回显、未改动不提交 config”的现有规则；权限变化不能从旧缓存补回 target/secret，也不能在复制/Tooltip 中泄露被遮蔽内容。
- RuleGroupsView 按每条规则实际 projectId 决定编辑能力；项目管理员不改组织模板或其他项目规则，不能统一使用当前项目 canManage 覆盖列表所有行。
- 普通成员只加载后端已授权投影；模板摘要不含 tree 时不用 RuleTreeView 强行恢复全文；只读绑定详情使用服务器允许展示的字段。
- 新建规则组时项目管理员锁定当前项目，隐藏组织范围；只有组织能力允许时才可选组织模板。
- MonitorEditorDialog/MonitorDetailView 的组织全量规则读取替换为已确认的安全候选契约；详情 loadRules、保存后 commitBindings 每个阶段校验 generation 和 scope。
- 渠道页面及渠道概览仅组织管理能力访问，不能将普通用户拿到的最小 channel-options 当作完整配置/历史接口。
- 探针/渠道最小选项用于本项目绑定，不表示可管理共享资源。本仓库尚未有完整探针绑定表单；只适配实际使用点，不扩建探针产品。
- organization overview 必须使用后端已过滤统计，不能全量取数后隐藏行；当前项目大盘继续项目范围，并随权限代次刷新。
- status-pages/probes 等 Placeholder 路由也标明组织管理门槛，但不在本次实现其完整产品。

### 6.3 后续任务/附件接入约束

当前没有相应 UI，以下不是本轮交付页面：

- 负责人候选来自项目成员，后端最终验证 MEMBER+；提及候选可读成员，不拉完整组织目录。项目成员最小字段及可分配标志仍需固定，不能让前端猜邮箱或有效角色。
- 任务第一方附件只走服务器 PRIVATE 上传/授权下载，不直接永久公开链接；UNKNOWN 禁止下载，EXTERNAL 仅保护元数据。
- blob 下载携带认证，短期签名链接不持久化，object URL 撤销后释放；前端不能追回已下载字节。
- 公开状态页属于主动发布例外，不与私有项目权限混为一谈。
- PAT 页面/接入指引明确“scope 与当前项目权限同时生效”，组织 API Key 不冒充创建者个人 grants；不新增前端组织 ACL 旁路。

## 7. 错误、缓存与权限变化

### 7.1 请求错误协议

在现有注入 hooks 模式上扩展，不让 request.ts import store：

- 保留 Error.message 使用方式，新增结构化 ApiError 的 status、可选稳定业务 code、必要 requestContext；不保存完整敏感请求/响应体。
- 如果后端尚无稳定 error code，按 status + 发起接口上下文分类，不能匹配中文 message 决定重试或授权。
- 单次错误只提示一次；页面处理冲突时允许抑制全局 toast。取消/过期请求不显示误导性错误。

| 结果               | 行为                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| 401 非登录业务错误 | 同账号续期一次；真正失效统一清 user/org/permissions/notifications，跳登录        |
| 403 项目操作       | 立即禁用该作用域写入口并失效能力/敏感数据；重验后若仍可读，保持只读页面          |
| 404 项目/详情      | 清该资源敏感缓存并重验项目能力；项目无权则回安全列表；仅子资源删除则保持项目选择 |
| 403 组织管理资源   | 清相应目录/配置，更新组织能力；不直接撤销仍合法的项目读取                        |
| 409 授权 PUT       | 最新 GET + 差异确认，不重放旧草稿                                                |
| 409 邀请动作       | 重读状态，禁止自动接受重试                                                       |
| 400 表单           | 定位输入问题，无权时不能继续保存                                                 |
| 网络/5xx           | 进入故障状态，可人工重试；权限重验失败时不保留旧高权限 UI                        |

仅当错误对应当前仍有效的请求上下文，才触发当前页面导航。旧组织的 404 或普通字典接口错误不得把用户当前工作区清空。

### 7.2 缓存隔离与销毁

权限失效事件是统一入口：递增 permissionEpoch，清能力及受影响正文/ETag，取消请求和动作、关闭弹窗，然后重拉。初版可保守失效当前全部受保护工作区缓存，账号级非敏感偏好保留。

- `MonitoringRequestState` 缓存 key 至少隔离 session、org、project、Membership ID、权限版本或当前权限代次、查询参数；权限改变即便 projectId 不变也清理。
- state.clear 后开始前的 load 不得 entries.set；即便页面用 generation 拒绝展示，也要阻止缓存内部被旧响应污染。
- 304 只在同一有效权限上下文且确有 body 时复用；缺 body 无条件补请求。降权/撤权先清 ETag/body；后端必须先授权再判断 304。
- keep-alive 的子组件 key 变化会保留旧实例，不能只换 key。权限代次变化要重建整个缓存容器或显式淘汰受保护实例；账号/组织清理必须包括标题、抽屉、Teleport、行选中项和图表实例。
- 通知详情/列表的局部状态也要清理；重载时不继续显示之前已撤权的正文和精确计数。
- 不清空浏览器全部 localStorage；仅处理本应用相应 key。不在该方案迁移 token 到 cookie，也不复制 token 到新的缓存。

### 7.3 没有专用权限事件时的刷新

现有 SSE 只消费通知帧，没有已确认的 `permissions.changed` 事件。不能假设撤权一定推送到浏览器。

最小方案：进入路由、重新激活缓存页、窗口 focus/重新可见、网络恢复时重验当前组织/项目能力；前台活跃工作区建议每 60 秒重验当前两层能力，去重且后台暂停。写操作依然接受服务器最终授权。

60 秒是拟定的 UI 刷新上限，不是后端撤权生效窗口，也不是离线保证；产品必须确认可接受时限。若要求无需操作的近实时清屏，需要额外确认失效信号契约，不能靠现有通知 SSE 伪称已实现。

多标签页使用本地 BroadcastChannel 或 storage 事件传递“失效/退出”信号即可，不广播 token、项目数据或 grants。其他标签收到后清理并重验，不把消息本身当作授权。SSE 重连/恢复也重拉当前权限、通知列表和 count。

## 8. 消息中心联动

- 保留 fetch + Authorization header SSE，不将 JWT 放入 EventSource URL。
- 项目通知列表/详情/未读数以当前后端过滤结果为准；权限失效后清 recent、页面局部正文、filterTotals 及受影响 dedupe 状态，再重拉。
- 账号/权限代次绑定 SSE connection 与批次回写；旧流关闭后的帧和旧 REST 响应不能恢复被清理内容。
- ACCOUNT/INVITATION 与 PROJECT 范围区分。不能把当前团队无项目视为所有个人通知都无权，也不能为通知展示读取完整组织目录。
- 已知项目已失权时不直接插入 SSE 正文；能力未知/重验中先触发授权 REST 刷新。确切通知 scope/字段需以后端最终投影为准。
- prepareNotificationTarget 保留“服务器列表确认后 applyWorkspace”的方式，增加能力校验和权限代次。meta 中 orgId/projectId/URL 只作提示，不作为可信访问依据。
- 跳转前确认目标当前可访问；拒绝时提示中性错误并刷新通知，不能兜底到任意其他项目然后打开同一个资源 ID。
- 重新授权后应能显示当前合法通知，不能因旧 seen Set 永久屏蔽；重连重复帧仍不能撤销本地已读/删除结果。
- 未读数字是服务端结果，不以收到一帧就 +1；前端本地修正不能暴露撤权项目原计数。
- 不承诺撤销已经显示的桌面通知、已发送邮件、外部群消息或已下载文件。

## 9. 本轮实施范围

本节定义本轮源码修改边界；实际入口和文件用途见实施记录。未扩建敏捷任务、迭代、评论、附件或无关占位产品。

### 允许修改

| 范围                                                                                                                                                                                                                                   | 限制                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `D:/WorkSpace/beacon-web/src/api/{modules,types}/`、api/types.ts、api/index.ts                                                                                                                                                         | 权限/邀请/最小候选 API、投影及导出，不变更无关业务契约              |
| `D:/WorkSpace/beacon-web/src/stores/modules/{permissions,organization,user,notification}.ts`、stores/index.ts                                                                                                                          | 能力、统一状态清理、续期代次及通知范围                              |
| `D:/WorkSpace/beacon-web/src/composables/use{OrganizationRole,ProjectAccess,MonitorAccess,TeamMembers,TeamPlans,MonitoringDashboard,MonitorDetail,MonitorList,MonitorActions,ChannelList,ChannelActions,TeamAuditLogs,TeamApiKeys}.ts` | 只改对应能力来源、请求门禁、失效和异步保护                          |
| `D:/WorkSpace/beacon-web/src/{permission.ts,main.ts,utils/request.ts,utils/monitoring-request-state.ts,utils/team-presenter.ts,utils/feature-search.ts,config/search.ts,types/router.d.ts,router/routes.ts,router/menu.ts}`            | 作用域、错误协议、菜单搜索路由统一、账号代次                        |
| `D:/WorkSpace/beacon-web/src/layouts/{index.vue,components/}`                                                                                                                                                                          | 权限缓存淘汰、入口过滤；布局只改新增工作流必要窄屏约束              |
| `D:/WorkSpace/beacon-web/src/components/{team,monitor,rules,notifications,search}/`                                                                                                                                                    | 新授权抽屉、邀请表单、作用域约束、敏感投影、通知处理                |
| `D:/WorkSpace/beacon-web/src/views/{team,monitor,rules,dashboard,notifications}/`                                                                                                                                                      | 能力接入、空状态、撤权和缓存；不新增完整任务系统                    |
| `D:/WorkSpace/beacon-web/src/views/auth/InvitationView.vue`                                                                                                                                                                            | 拟新增最小邀请落地页，不改登录/2FA 产品流程                         |
| `D:/WorkSpace/beacon-web/src/views/account/AccessTokensView.vue`、components/guide/、components/overview/TokenGuideSection.vue                                                                                                         | 仅 PAT 权限及开发者入口文案                                         |
| `D:/WorkSpace/beacon-web/src/locales/`、src/icons/index.ts                                                                                                                                                                             | 中英文权限文案及实际需要的现有图标导出                              |
| `D:/WorkSpace/beacon-web/package.json`、pnpm-lock.yaml、vitest.config.ts、playwright.config.ts、tsconfig.test.json、test/、必要 CI 文件                                                                                                | 仅经确认的 ACL 验证基础设施；合并用户已有 lockfile 变更，不重写覆盖 |
| `D:/WorkSpace/beacon-web/docs/`、README.md                                                                                                                                                                                             | 契约、验证和状态记录；README 只修本次关联描述                       |

以上源码子路径为边界，不意味着每个文件都需要改。实施时建立实际 touched-file 清单，逐项说明用途。

### 不允许修改

- 后端源码、schema、迁移、生产 ACL 清单；发现契约不足应报告后端需求，不跨仓悄悄实现。
- `.env*` 的实际值、无关依赖升级、全仓 format/lint --fix、无关路由/主题重做。
- 支付、订阅价格/业务规则、监控协议和调度算法、登录/2FA 产品流程、平台后台产品功能。
- 任务/迭代/评论/附件完整页面、当前占位探针/状态页完整产品。
- 用户既有修改，不切分/删除其 lockfile 或 env diff。
- 未另获授权的 Git 提交、推送、PR 和真实外发邀请/邮件/告警。

未来实施可采用 `codex/project-access-control-web` 分支，但不自动切分支。以该前端仓库实时分支约定确定 PR 目标，不把后端 master 规则直接套入前端。

## 10. 实施阶段与验证门禁

以下阶段保留原始规划顺序作为验收分类，本轮一次性交付全部前端 ACL 业务；当前实际命令、测试文件和结果以实施记录为准。

### 阶段 0：契约与基线

确认第 2.3 节产品项，固定 my-permissions、授权 GET/PUT、最小选项、规则投影、公开邀请预览、错误响应与刷新时限。记录前后端版本及每个接口的实施状态。

先执行漂移检查，保护用户现有改动：

```powershell
git status --short
git diff --stat 29740bd..HEAD -- src package.json tsconfig.app.json
git diff --stat -- src package.json
```

在前端根目录运行现有质量命令并记录真实结果：

| 已存在的命令                               | 用途/成功条件                                          |
| ------------------------------------------ | ------------------------------------------------------ |
| `pnpm type-check`                          | 应用类型检查 exit 0；会写 node_modules/.tmp 的增量信息 |
| `pnpm exec oxlint src`                     | 不带 --fix 的源码检查 exit 0                           |
| `pnpm exec eslint src`                     | 不带 --fix/--cache 的源码检查 exit 0                   |
| `pnpm build`                               | 类型检查 + 生产构建 exit 0，产物 dist                  |
| `pnpm dev -- --host 127.0.0.1 --port 5174` | 后续人工联调；端口占用另选，不连接真实外发服务         |

现有 `pnpm lint` 包含 --fix，`pnpm format` 写全仓；不作为只读调研命令。未来提交前如使用 fix，仅对本次文件并检查 diff，不误格式化用户文件。

类型/构建既有失败先记录并修复获准范围内问题；需要范围外改造时暂停，不排除文件或降低严格度过关。阶段 0 完成前不宣称后续门禁有效。

### 阶段 1：验证基础设施、API 类型与错误协议

当前没有测试基线，建议建立 Vitest + Vue Test Utils 的单元/组件测试和 Playwright E2E；使用版本需实施时核对 Node/Vite/TS 兼容，**不在本文固定未验证版本**。执行者应查看届时官方最低运行要求及候选版本的 peerDependencies，并实测本仓库插件/TS 兼容，不能仅凭工具支持 Vue 就认为可直接安装。

官方参考入口：

```text
https://vitest.dev/guide/
https://test-utils.vuejs.org/guide/
https://playwright.dev/docs/mock
```

新增独立 test 配置复用 `@` alias、Vue 插件和必要定义，不直接加载含真实代理/环境配置的开发服务。test tsconfig 显式包含测试文件；本仓库应用 tsconfig 排除测试，需单独检查。

按第 3、7 节补类型、helpers、ApiError、认证 epoch；先编写错误状态和会话竞争回归。单元测试全部 mock 请求，E2E 使用本地 fixture/mock API，默认拒绝未匹配外网请求。

拟新增 scripts（当前不存在，只有实施后才能执行）：

| script          | 建议命令                                        | 成功条件                    |
| --------------- | ----------------------------------------------- | --------------------------- |
| test:unit       | `vitest run`                                    | 指定及全量单元/组件测试通过 |
| test:e2e        | `playwright test`                               | 项目 ACL E2E 全通过         |
| type-check:test | `vue-tsc --project tsconfig.test.json --noEmit` | 测试类型检查 exit 0         |

**门禁**：`pnpm type-check`、新增 `pnpm type-check:test`、`pnpm test:unit -- test/unit/request-permissions.spec.ts test/unit/invitation-api.spec.ts` 均 exit 0。不伪造此前不存在的绿色测试。

### 阶段 2：权限 store、工作区、路由和缓存

先完成 account/organization/project 状态及 session/workspace/permission epoch，再替换 useOrganizationRole/MonitorAccess。使业务请求依赖 ready 能力；组织订阅不阻塞项目。

接入菜单/二级导航/搜索/顶栏、路由守卫、无项目状态和 keep-alive 淘汰。清理 ETag 缓存内部回写，覆盖清理后旧响应晚到及旧续期回写。

**门禁**：`pnpm test:unit -- test/unit/permissions-store.spec.ts test/unit/workspace-permissions.spec.ts test/unit/navigation-permissions.spec.ts test/unit/monitoring-cache.spec.ts` 与两类 type-check 全通过。

### 阶段 3：邀请与成员授权

实现邀请项目表及逐项角色、ADMIN 风险确认、成员权限抽屉、双前提 PUT、409 差异确认、认证邀请投影和接受后刷新。

新抽屉可复用项目选择子组件，但邀请与全量替换的数量/空数组规则分开，不创建通用动态权限表单框架。

**门禁**：`pnpm test:unit -- test/components/member-invite.spec.ts test/components/member-project-permissions.spec.ts test/components/invitation-actions.spec.ts`、两类 type-check 全通过。核对请求 payload 不含 token/内部 issuer 字段。

### 阶段 4：监控、规则、共享资源与通知

按实际项目 scope 接入动作、脱敏展示、规则每行能力、模板最小摘要、渠道门禁；改造详情规则异步回写。补通知失效/重连/深链接、前台权限重验和多标签页信号。

若规则候选或 DTO 投影仍未固定，停止相关页面实施，不回退全量组织读取。用户无项目时个人通知/账号页继续可用。

**门禁**：`pnpm test:unit -- test/components/monitor-access.spec.ts test/components/rule-scope.spec.ts test/unit/notification-permissions.spec.ts`、两类 type-check 全通过。

### 阶段 5：双仓联调与发布验收

fixture 只代表前端交互验证，另在安全测试环境对真实后端 JWT/guard 响应做联调。使用指定测试用户、邮箱桩/告警桩和隔离存储；不连真实团队验证邀请或发送测试告警。

**门禁**：

```powershell
pnpm type-check
pnpm type-check:test
pnpm test:unit
pnpm test:e2e -- test/e2e/project-access.spec.ts
pnpm exec oxlint src test
pnpm exec eslint src test
pnpm build
git status --short
```

全部 exit 0；权限验收零 skipped/todo；所有新增 diff 对照范围，用户既有修改原样保留。确认最终 lint 配置覆盖测试目录，否则调整本次测试配置而不是跳过检查。

E2E 配置自启本地服务，禁用真实代理并拦截 `/api`，复用已存在任意 dev server 前必须验证其运行模式与 mock 边界。单元/组件/E2E 不能发送真实邀请、调用支付或连真实监控目标。

## 11. 验收矩阵

至少使用两账号 U1/U2、两组织 O1/O2、O1 下项目 A/B/C、新增 D、组织 OWNER/ADMIN/MEMBER/VIEWER、平台 SUPER_ADMIN 的测试数据。

| 场景                                     | 自动化期望                                                |
| ---------------------------------------- | --------------------------------------------------------- |
| MEMBER：A=VIEWER、B=ADMIN、无 C          | 切换器仅 A/B；A 无写入口，B 可管理监控，C 深链不可用      |
| 新增 D                                   | 普通成员列表不出现 D；组织 OWNER/ADMIN 可见               |
| 无 grants                                | 正常无项目状态；个人账号/通知可用，无新建项目 CTA         |
| 角色查询网络失败/未知字段                | 故障可重试，不显示旧高权限内容，不全项目 fallback         |
| MEMBER 普通邀请未选项目/超过100项/重复项 | 前端拒绝提交，后端400正确处理                             |
| MEMBER 邀请 A=VIEWER、B=ADMIN            | 请求/认证详情/接受前摘要一致，组织仍 MEMBER               |
| 组织 VIEWER 邀请                         | 逐项只读，不可恢复此前写角色                              |
| 组织 ADMIN 邀请                          | 无 projects 字段，全部当前/未来项目确认；无授予能力不显示 |
| 已有成员 email，服务器409                | 引导成员授权，无重试邀请或部分 grants 写入                |
| 授权全量替换、搜索、翻页、归档 grants    | 非可见选择仍保留；未明确归档规则不保存；无静默撤销        |
| 空数组 grants PUT                        | 明确撤销全部，不变成全项目                                |
| 同代次版本冲突                           | 409 后 GET + 用户差异确认，旧 PUT 不自动再次发送          |
| 离开重加，版本碰巧相同                   | 旧 membershipId 草稿作废，不改写到新成员关系              |
| 普通成员/项目 ADMIN                      | 不请求完整目录、渠道日志、组织审计、订阅；没有对应入口    |
| 组织 ADMIN 目标管理                      | OWNER/ADMIN 特殊目标约束准确，不能统一 canManage 提权     |
| 监控 MEMBER 手动检查 vs 测试告警         | 仅检查允许；后端拒绝不导致误登出                          |
| 项目 ADMIN 编辑规则                      | 只改本项目；组织模板只能允许的摘要/绑定，不可编辑         |
| 项目归档/删除                            | 普通写能力关闭，生命周期操作按独立能力显示                |
| 当前 B 但详情路由 A                      | 使用 A 能力，不能借 B 的 ADMIN 操作 A                     |
| 详情中的子资源404                        | 清详情并保留合法项目；项目无权404才回落工作区             |
| org O1 旧请求404，用户已切O2             | 不弹旧提示、不清O2、不触发旧导航                          |
| U1退出后U2登录，旧续期/列表晚到          | 不回写 U1 token/user/org/正文，不重放U1请求               |
| B ADMIN降为VIEWER，projectId未变         | 高权限正文/编辑器/ETag/图表清理，重新加载脱敏内容         |
| state.clear 后旧请求完成                 | entries 不被重新污染，304不复用旧高权限body               |
| keep-alive返回/浏览器前进后退            | 重新验证，无旧敏感页面/标题/Teleport复现                  |
| 授权PUT成功响应丢失                      | 提示结果待确认，重读状态；不盲重试替换                    |
| 撤权后通知 list/detail/count/SSE/重连    | 不复现撤权正文或原精确计数，旧异步帧被拒                  |
| 邀请接受时原projects非空                 | 仍刷新能力/项目/通知，不遗漏新grants                      |
| 通知深链接无权/父级不一致                | 不展示缓存名，不借另一个项目打开同一ID                    |
| 公开邀请/登录回跳                        | 无项目名/角色/发送人邮箱/内部代次泄露，token不持久化      |
| SUPER_ADMIN持久化快照已过期              | 后端拒绝时清能力，不因本地globalRole旁路                  |
| 网络断开/权限重验失败                    | 不承诺即时撤权感知；已知失效数据不继续展示                |
| 多标签页/前台60秒重验                    | 仅发送失效信号，重拉当前作用域，后台暂停，无无限请求循环  |
| zh-CN/en-US、长项目名、100项选择         | 文案完整，控件无重叠，选择/角色不因搜索丢失               |

UI 验收覆盖桌面 1440x900、平板 768x1024、移动 390x844，以及明暗主题；尤其团队页当前继承最小宽度布局，需仅为新增授权工作流适配，不顺带全站重做。用截图检查弹窗/抽屉和标签换行、滚动、键盘焦点及 loading/denied/error 状态。网络 payload、DOM、store 与缓存断言共同使用，不能只验证按钮不可见。

真实后端联调还应验证：403/404语义、PUT双前提、无权旧ETag不304、项目选择过滤和通知count过滤。前端 mock 通过不等于后端授权通过。

## 12. 发布、停止条件与完成标准

### 发布协调

- 后端 v2 已在工作区实现，但尚未完成真实数据库及发布验收；不允许前端靠 404 fallback 接旧权限语义。先核对实际契约、mock 开发，再安全测试环境联调。
- 新前端普通邀请要求 projects，旧前端普通邀请在新后端返回400；能力接口也是新依赖，必须协调上线，不单独放开半成品。
- 扩展 schema 不等于 ACL 已生效；正式切换按后端维护窗口处理全部 API/worker、授权清单、旧邀请和缓存 namespace。
- 前端使用构建版本提示更新，可清自身旧能力/业务缓存；长期打开旧页面仍可能发旧请求，后端必须拒绝，不能依赖“强制刷新页面”建立安全性。
- 首发不提供关闭ACL回退到全组织权限的开关。回滚维持维护/拒绝模式及授权数据，不开放旧全部项目访问。
- 观察邀请400/409、能力接口403/404、工作区加载、重验频率、缓存失效和通知count；不采集 token、项目目标或成员邮箱作为日志维度。

### 停止条件

1. 要求“组织 ADMIN 仅限几个项目”或“项目 ADMIN 管团队邀请/ACL”，应重做产品模型。
2. 后端没有 my-permissions、双前提或安全规则候选，且要求前端回退旧目录/全量数据；暂停，不模拟授权。
3. capability schema、脱敏 DTO、SUPER_ADMIN 分支、归档授权保留或目标成员限制不明确。
4. 需要改本地环境秘密、后端迁移、支付/协议等范围外实现。
5. 核对到用户并行改动使目标事实变化，先重新对齐，不覆盖其 diff。
6. 测试只能接真实外发服务或生产用户，不能安全 mock/隔离。
7. 基线失败或同一验证合理修复两次仍失败，不关闭断言、忽略类型、标skip过关。
8. 产品要求撤权追回已发邮件/下载文件、离线浏览器即时清屏，超出本方案可保证边界。

### 完成标准与当前结果

- [x] 产品规则、实际能力/投影 DTO、错误与 UI 重验时限已有源码契约记录。
- [x] 普通身份默认无项目权限，目录不作为自身角色来源，项目/组织动作分离。
- [x] 邀请、接受、授权替换与冲突流程符合已核对契约，成员关系ID+版本共同保护。
- [x] 工作区、续期、keep-alive、ETag、规则详情及通知加入失效与旧响应回归。
- [x] 已实际执行44项单元/组件与35项隔离浏览器测试，无 skipped/todo；覆盖明细见实施记录。
- [x] 应用/测试类型检查、lint、build及diff检查均exit 0；记录的是本轮前端结果。
- [x] 桌面/平板/移动明暗截图通过，新增中英文完整；前端不充当服务器授权边界。
- [x] 新 diff 限定范围，保留用户已有 env/lockfile 变更，没有真实外发、提交或推送。
- [ ] 安全测试环境下真实后端/数据库联调通过。
- [ ] 前后端正式发布协调与生产验收完成；本目录DONE仅指前端实施及本地隔离验收。

维护要求：每次增加页面、搜索入口、后台候选、导出、聚合或缓存，都同时声明作用域、能力、数据投影和失效条件，并补无权及异步竞争回归；不能重新引入“缺项目ID/权限查询失败就读全部”的便利路径。
