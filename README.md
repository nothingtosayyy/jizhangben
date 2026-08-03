# 债务记账 (Debt Tracker)

一个用于记录个人对内对外债务的 Web 应用，简单的统计分析 + 账号登录。

## 技术栈

- **前端**: Vite + React 19 + TypeScript + [Astryx](https://github.com/facebook/astryx) (Meta 开源设计系统) + React Router
- **后端**: Node.js + TypeScript（API 路由）
- **数据库**: Postgres（生产）/ PGlite（本地开发，无需 Docker）
- **ORM**: Drizzle ORM
- **认证**: 自实现 session（HMAC 签名 cookie + bcrypt 密码哈希）
- **部署**: Vercel

## 功能

- 记录债务：方向（借出 / 借入）、对方、金额、已还、日期、备注、状态（未还 / 部分还 / 已还清）
- 简单统计：借出/借入总额、未还金额、净额，按方向/状态/对方汇总
- 账号登录（不开放注册）：首个启动自动创建 admin 账号；管理员可在用户管理页动态创建/禁用/重置密码

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动 API + Vite（同时启动）
#    无需设置 DATABASE_URL，会自动使用 PGlite（嵌入式 Postgres，数据存到 .pglite/）
npm run dev
```

- 前端：http://localhost:5173
- API：http://localhost:3001

首次启动会自动创建管理员账号：
- 用户名：`admin`
- 密码：`admin123456`

请在登录后立即通过"用户管理"页修改默认密码。

## 部署到 Vercel

1. 将代码推送到 GitHub 仓库
2. 在 Vercel 中导入项目，framework 选 "Other"
3. 在 Vercel 项目中添加 **Neon Postgres** 集成（Storage → Marketplace → Neon）
   - 集成会自动注入 `DATABASE_URL` 等环境变量
4. 设置环境变量：
   - `SESSION_SECRET`：32+ 字符随机字符串
   - `ADMIN_USERNAME`、`ADMIN_PASSWORD`：首次部署的初始管理员账号（可选）
5. 部署后访问默认域名，用初始账号登录

首次部署时，Vercel Function 会自动调用 `ensureAdminUser` 创建管理员（如果不存在）。

## 项目结构

```
api/
  dev.ts                 # 本地开发启动
  server.ts              # Node HTTP server（开发用）
  [[...path]].ts         # Vercel Function（生产 catch-all）
  auth.ts                # session 签名/校验
  http.ts                # HTTP 工具
  index.ts               # ensureAdminUser seed
  db/
    client.ts            # Drizzle client（pglite / postgres-js）
    schema.ts            # users / debts schema
    serializers.ts       # DB row -> API DTO
  routes/
    auth.ts              # 登录/登出/me
    debts.ts             # 债务 CRUD
    stats.ts             # 统计
    users.ts             # 用户管理（管理员）
src/
  main.tsx               # React 入口（Astryx Theme + Router）
  App.tsx                # 路由表
  lib/
    api.ts               # 前端 API client
    auth.tsx             # Auth context
  pages/
    Login.tsx
    Dashboard.tsx
    Debts.tsx
    Users.tsx
  components/
    Layout.tsx
  styles/
    global.css
shared/
  types.ts               # 前后端共享类型
vercel.json              # Vercel 路由配置
```

## 数据库 Schema

- `users`: id, username(unique), password_hash, role(admin/user), active, created_at, updated_at
- `debts`: id, owner_id (FK), party_name, direction (lend/borrow), amount, paid_amount, status (unpaid/partial/paid), occurred_at, note, created_at, updated_at
