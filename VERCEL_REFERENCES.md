# Deployment references used for this Vercel copy

Checked 2026-10-28.

- Vercel Express: https://vercel.com/docs/frameworks/backend/express — an Express app can be exported as a Vercel Function; static assets are served from root `public/**`; `express.static()` does not serve them on Vercel.
- Vercel Vite: https://vercel.com/docs/frameworks/frontend/vite — Vite deployments support Git integrations; client-side SPA routes need correct fallback behavior when using static output.
- Vercel Git deployment: https://vercel.com/docs/git — importing a repository from Vercel's dashboard enables preview deployments for branches and production deployments from the configured production branch.
- Vercel environment variables: https://vercel.com/docs/environment-variables — environment variables are configured per project/environment, can be provided by Marketplace integrations, and changes apply to new deployments.
- Vercel CLI environment commands: https://vercel.com/docs/cli/env and https://vercel.com/docs/cli/pull — `vercel env run -e production -- <command>` supplies the linked project's Production variables directly to a local command; `vercel pull --environment=production` pulls Production settings to the local Vercel cache.
- TiDB Cloud with Vercel: https://docs.pingcap.com/tidbcloud/integrate-tidbcloud-with-vercel/ — connect a TiDB cluster through the Vercel integration; it can create connection variables including `DATABASE_URL` for selected frameworks. TiDB is MySQL-compatible.
- TiDB Cloud marketplace: https://vercel.com/marketplace/tidb-cloud — the listing describes TiDB Serverless and advertises up to five free clusters; confirm provider terms and quotas when creating an account.
- Drizzle MySQL driver: https://orm.drizzle.team/docs/get-started-mysql — Drizzle supports the `mysql2` driver and `DATABASE_URL` configuration.
