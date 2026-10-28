# syntax=docker/dockerfile:1

# ============================================================
# 构建阶段：Node 环境打包静态资源
#   docker build -t beacon-web .
#   docker run -d -p 8080:80 -e BACKEND_ORIGIN=https://beaconix.app/api beacon-web
# ============================================================
FROM node:24-alpine AS build

# 项目使用 pnpm（见 pnpm-lock.yaml），固定大版本避免 lockfile 兼容问题
RUN npm install -g pnpm@10

WORKDIR /app

# 先只拷贝依赖清单，源码改动时可复用依赖安装层
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# production / test 分别对应 .env.production、.env.test；等价于 pnpm build（类型检查 + vite build）
ARG BUILD_MODE=production
RUN pnpm type-check && pnpm exec vite build --mode "${BUILD_MODE}"

# ============================================================
# 运行阶段：nginx 托管静态资源并反向代理 /api
# ============================================================
FROM nginx:alpine AS runtime

# 后端地址：只写 协议 + 主机 + 端口，不要带 /api 或其它路径
#（前端请求的 /api/xxx 会按原样拼在后面；写成 .../api 会变成 /api/api/xxx）。
ENV BACKEND_ORIGIN=http://127.0.0.1:9000

# nginx.conf 作为 conf.d 站点配置的模板
COPY nginx.conf /etc/nginx/templates/default.conf.template
# 移除镜像自带的默认站点，避免与模板渲染结果冲突
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

# 使用官方镜像的默认入口脚本（含 envsubst 渲染与 nginx -g 'daemon off;'）
CMD ["nginx", "-g", "daemon off;"]
