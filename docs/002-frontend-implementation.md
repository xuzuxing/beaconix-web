# 002：前端实施与验收记录

## 1. 状态与范围

- 日期：2026-10-13。
- 前端基线：`e33e9137f5eb44caecbfab756a7caec22f86e951`，本轮变更尚未提交。
- 状态：DONE（前端代码全量实施 + 本地隔离验收）；真实后端联调与生产上线未执行。
- 后端对齐：`D:/WorkSpace/beacon` 中项目 policy、成员权限 service/controller、邀请 DTO、规则与监控投影的实际源码，以及 `advisor-plans/002-backend-integration.md`。
- 沿用 Vue、Pinia、TDesign、Hugeicons 和原有监控工作台，不重做主题或登录/2FA。
- 未修改后端源码/schema/迁移；未调用真实业务 API/数据库，未发送真实邀请、邮件或告警，未提交/推送。
- 保留用户既有 `.env.development` 与 lockfile 修改；未读取环境变量秘密，仅合并测试依赖所需 lockfile 内容。

本轮是现有前端业务的完整 ACL 接入，不将邀请、成员授权、监控、规则、共享资源、通知或缓存留作分批业务。任务/迭代/评论/附件并不是该前端原有产品，本轮不创建这些产品。探针等原有占位页面仅加入权限门禁，不宣称已经扩建完整产品。

## 2. 实际接口契约

helpers 使用不带 `/api` 的路径。服务端全局 `/api` 前缀沿用原有代理配置，不修改 `.env`。

组织能力返回：

```typescript
interface OrganizationPermissions {
  organizationId: string
  organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null
  membershipId: string | null
  projectPermissionsVersion: number | null
  accessMode: 'ALL_PROJECTS' | 'SELECTED_PROJECTS'
  capabilities: {
    manageOrganization: boolean
    manageProjectPermissions: boolean
    inviteMembers: boolean
    grantOrganizationAdmin: boolean
  }
}
```

项目能力额外返回 `projectId`、`assignedRole`、`effectiveRole`，实际使用能力键：

```text
monitor.read
monitor.check
monitor.manage
monitor.test-alert
rule.manage
```

MEMBER 可手动检查，ADMIN 可管理/测试告警。组织 VIEWER 的有效项目角色封顶 VIEWER；组织 OWNER/ADMIN 继承全部现有与未来项目。归档项目关闭普通业务写能力但保留授权读取。不以角色排序替代 action capability。

| API                                                             | 实现用途                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /organizations/:orgId/my-permissions`                      | 组织管理、邀请、授权、订阅与共享资源门禁                             |
| `GET /projects/:projectId/my-permissions`                       | 项目工作区、明确路由项目与操作能力                                   |
| `GET /organizations/:orgId/members/:userId/project-permissions` | 完整授权快照、membershipId 与权限版本                                |
| 同路径 `PUT`                                                    | 完整 projects 替换，同时提交 expectedMembershipId 和 expectedVersion |
| `POST /organizations/:orgId/invitations`                        | 普通邀请 1-100 个显式项目；ADMIN 省略 projects 并确认全部项目权限    |
| `GET /invitations/:token`                                       | 匿名白名单 `{ organizationName, status, requiresLogin }`             |
| `pending` / `by-id` 邀请接口                                    | 认证详情包含 accessMode 和固定项目名称/角色，移除 token              |
| 项目 members / probe-options / notification-channel-options     | 提供最小候选 helpers，不通过完整组织目录/配置补齐                    |
| 现有 rule-groups 与 rule-bindings                               | 使用服务端过滤列表；已绑定组织模板摘要可展示/解绑，不读取全文        |

项目成员最小字段为 `id/name/avatarUrl/effectiveRole`；探针为 `id/name/status`；渠道为 `id/name/type`。未虚构可分配字段或新规则候选路由。

PUT 的空 projects 是明确撤销全部，需要确认。归档/不可用授权保持可见，恢复或明确移除前禁止保存，不静默过滤后替换。409 后重读并锁定旧保存入口；membershipId 改变则废弃旧草稿；网络结果不确定时禁止盲重试。

公开预览不能推导邀请 ID。因此登录后用 replace 清除 token 路径，进入本人通知/邀请列表，认证 by-id 详情显示授权范围后再接受。token 不写入 Pinia/localStorage；入口设置 no-referrer。

## 3. 已实施业务

| 区域        | 实际入口/文件                                                                                        | 行为                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 权限        | `src/api/{modules,types}/permissions.ts`、`src/stores/modules/permissions.ts`、`useProjectAccess.ts` | 非持久化、去重、ready 才放行、未知契约拒绝、失效清 sibling authority                 |
| 身份/工作区 | `user.ts`、`organization.ts`、`useOrganizationRole.ts`                                               | 已验证当前平台身份；先能力再项目；订阅可选；无 grants 正常空状态                     |
| 导航        | `permission.ts`、`navigation-access.ts`、menu/search/layout/header                                   | 路由、菜单、搜索、二级导航同口径；深链项目优先；故障恢复不循环                       |
| 邀请        | `MemberInviteDialog.vue`、`ProjectGrantSelector.vue`、`InvitationScope.vue`、`InvitationView.vue`    | 项目搜索与逐项角色、VIEWER 降级、ADMIN 确认、认证接受前展示 scope                    |
| 成员授权    | `MemberProjectPermissionsDrawer.vue`、`TeamMembersView.vue`、`team-presenter.ts`                     | 完整替换、变更摘要、双前提、409/ABA、归档保留、明确撤销全部、特殊身份约束            |
| 监控        | `useMonitorAccess.ts`、`useMonitorActions.ts`、监控 list/detail/editor                               | 明确项目能力、保存前重验、MEMBER 检查与 ADMIN 测试告警分离、凭据未改不重传           |
| 规则        | `RuleGroupsView.vue`、规则 editor/detail、监控 bindings                                              | 按每条实际项目授权；项目管理员不能编辑组织模板；摘要绑定可解绑                       |
| 共享资源    | 渠道/状态页 editor 与 composables、团队 API Key/信息/危险操作、订阅                                  | 按组织能力读取/提交；未知订阅不误标 Free；失权关闭编辑器                             |
| 通知        | `notification.ts`、邀请动作                                                                          | SSE 只触发授权 REST 重拉；失效清正文/count；接受邀请总是重拉工作区；深链校验真实归属 |
| 请求/缓存   | `request.ts`、`access-context.ts`、`monitoring-request-state.ts`、`AppContent.vue`                   | ApiError；会话/工作区/权限代次；旧续期/失败不覆盖新账号；ETag 与 keep-alive 淘汰     |
| 主动重验    | `main.ts`                                                                                            | 路由、focus/online/visibility、前台60秒；BroadcastChannel 只传失效/退出信号          |
| 文案        | access 中英文语言包、PAT/API Key 指引                                                                | scope 不扩大个人 grants，API Key 是独立机器身份                                      |

权限失效销毁页面缓存与 Teleport，不只是隐藏按钮。同项目降权重载脱敏正文；子监控404清详情与标题，合法项目仍保留。A→B→A 不复用旧项目权限 Promise；旧 U1 续期失败不能注销 U2。收到组织降权会重新加载服务器过滤项目并清订阅。

## 4. 测试与质量门禁

单元/组件：Vitest 5.0.3、Vue Test Utils 2.5.1、happy-dom 20.14.6。浏览器：Playwright 1.64.0 Chromium。

未降低包发布年龄策略或添加 supply-chain 例外。测试分别有应用/测试类型检查入口。`vite.acl.config.ts` 的隔离服务只绑定 `127.0.0.1:5187`，无真实代理；fixture 拦截全部 API，未知 API/外网请求均拒绝并使测试失败。不复用任意现有开发服务器。

本轮最终运行结果如下；未沿用后端测试数字，历史失败和中断运行均已修复后重跑，不计作通过。

| 实际命令                                                                             | 结果                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| `pnpm type-check`                                                                    | exit 0                                   |
| `pnpm type-check:test`                                                               | exit 0                                   |
| `pnpm test:unit`                                                                     | 8 个文件、44 项通过，无 skipped/todo     |
| `pnpm test:e2e`                                                                      | 35 项 Chromium 用例通过，无 skipped/todo |
| `pnpm exec oxlint src test playwright.config.ts vitest.config.ts vite.acl.config.ts` | exit 0                                   |
| `pnpm exec eslint src test playwright.config.ts vitest.config.ts vite.acl.config.ts` | exit 0                                   |
| `pnpm build`                                                                         | exit 0，生成 dist                        |
| `git diff --check`                                                                   | exit 0                                   |

独立只读复核发现的旧会话失败回写、A→B→A 权限复用、组织降权列表清理、身份故障重定向、归档读权限、模板摘要、撤权后导航及旧订阅失败问题均已修复并回归。最终对导航/订阅的复核无剩余发现；复核未修改文件或调用真实 API。

单元/组件覆盖：会话竞争、能力去重与失败、A→B→A、工作区/导航/菜单/搜索、缓存晚到/304、邀请白名单、邀请空/重复/超限/不可用选择、VIEWER 上限、授权PUT/撤销/归档/409/ABA/不确定结果、通知失效/旧SSE/父级不一致、子资源404及详情竞争。

浏览器覆盖：A只读/B管理/C-D不可见、组织资源拦截、无项目、降权/撤权/归档、身份故障恢复、平台旧快照拒绝、多标签失效/退出、监控创建/编辑/解绑/告警确认、成员授权 payload 与冲突、公开邀请/认证接受、桌面/平板/手机明暗主题、英文长项目名与100项选择、Escape关闭。

界面验收使用 1440x900、768x1024、390x844，截图由本地 fixture 产生，不含真实业务数据。检查页面及行宽、抽屉边界、角色控件、滚动、标签换行和控制台。测试报告与截图输出在 gitignored 的 `test-results/`。

## 5. 联调与发布边界

前端源码和本地隔离验收可完成；以下外部验收未执行，不能据此宣称部署完成：

1. 安全测试环境下真实 JWT/guard 与数据库联调，验证403/404、双前提PUT、scope投影、通知count及无权ETag不304。
2. 后端正式迁移、历史普通成员 grants 回填、旧邀请处理、worker/cache namespace 协调。
3. 前后端协调发布与生产验收；旧前端普通邀请不能绕过新后端显式项目要求。

这里不是遗留前端业务：本轮没有可用旧角色/目录算法的 fallback，也没有停用 ACL 的开关。服务器仍是安全边界；60秒重验不是离线即时撤权保证，已经发送/下载的内容不能追回。

## 6. 本地预览

开发服务已在 `http://127.0.0.1:5174/` 启动，使用项目现有 development 配置，没有修改环境文件。启动服务本身未发起业务请求；浏览器人工联调应使用安全测试账号/后端。自动化验收仍使用独立无真实代理的5187服务，不能将普通开发服务视为隔离fixture。
