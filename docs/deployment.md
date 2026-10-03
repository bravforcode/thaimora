# Production deployment — thaimora

This runbook supports the user's requested production launch. It does not record a hosted deployment. Existing client-owned accounts, free-plan capacity, real licensed catalog, approved legal copy and actual live tests are still required. Never mark an evidence flag true merely to unblock a command.

## Private environment

Use Node.js 24. Copy the existing .env.example to the ignored .env.production.local and fill actual configuration locally. scripts/production-command.mjs uses Node's loadEnvFile; already supplied process/CI environment takes precedence. The loader prints missing field names, never values. Keep this file outside version control and never place it in public/, out/ or a snapshot.

Both sites require matching SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL; NEXT_PUBLIC_API_URL must be that project's HTTPS /functions/v1/api endpoint. The browser receives its public anon/publishable key only. A service-role JWT/key cannot be used as NEXT_PUBLIC_SUPABASE_ANON_KEY. NEXT_PUBLIC_SITE_URL must be the real HTTPS origin, and ALLOWED_ORIGINS must include that exact origin. Comma-separated ALLOWED_ORIGINS and TURNSTILE_HOSTNAMES entries must contain no leading/trailing spaces; the preflight matches the Edge runtime's exact parsing.

GEOAPIFY_API_KEY and GEOAPIFY_RIGHTS_CONFIRMED=true are server configuration for real autocomplete/routing. Supply an approved HTTPS map style; Thaimora also accepts its restricted ArcGIS browser key. Hostname restrictions, licenses and free allowances need actual account verification.

Server/provider secrets belong in Supabase's private function environment. The local build environment uses the service role for sanitized export and post-build database validation; Next exposes only intentionally public NEXT_PUBLIC_* values. Revoke accidental exposure rather than deleting a warning or disabling a scan.

## Build and launch commands

Run from this repository:

```powershell
npm ci
npm run test:deployment
npm run production:check
npm run build:production
```

production:check validates configuration and the existing pre-build launch evidence/snapshot/legal gates. It makes no live-provider claim. build:production repeats those gates, builds the static export, repairs the actual HTML language attributes, then runs launch-gate.ts against database content and out/. Any failed command prevents the next step. Production cannot take the preview skip path.

Generate the production snapshot first with the existing authorized export job. Use the site's actual legal-file shape in docs/backend.md and a reviewed scripts/launch-evidence.json. Do not copy the all-false evidence template and change flags without the corresponding checks. The snapshot contains public catalog/content only. No exact private coordinates, credentials, inquiries, current hotel prices or availability belong there.

## Vercel — requested deployment target

The user selected Vercel-hosted *.vercel.app domains for the first deployment. vercel.json uses framework=null, an explicit production build, outputDirectory='out', and the existing static Next export. Node is pinned to 24.x. No existing client project is moved, upgraded or deployed by configuration alone.

Link each repository to the selected authorized Vercel account/project first. Set VERCEL_ORG_ID and VERCEL_PROJECT_ID to that actual project link; deploy:production rejects a different .vercel/project.json. The locally installed Vercel CLI version inspected was 50.38.3. VERCEL_CLI_PATH may specify an already installed CLI entrypoint on another workstation; the command does not install or log in automatically.

Vercel's Hobby terms permit noncommercial personal use. These property/affiliate sites require actual confirmation of a permitted hosting plan. Do not declare commercialHostingAllowed=true on Hobby, add a card, start a paid plan or silently accept automatic charges. Reviewed launch evidence must include hostingProvider='vercel', hostingPlanVerified=true and commercialHostingAllowed=true, supported by the selected account's real entitlement and the user's cost constraint.

The actual assigned HTTPS *.vercel.app origin must populate NEXT_PUBLIC_SITE_URL, CORS, Auth redirect allowlist and relevant browser key/Turnstile restrictions. No localhost fallback is accepted by the production configuration check. Public project/domain IDs are configuration, not proof of ownership or provider rights.

```powershell
npm run deploy:production
```

This command verifies the explicit local account/project link and Vercel plan evidence, invokes Vercel build --prod with the complete build:production gate, then deploys the resulting Build Output API artifact using deploy --prebuilt --prod --yes. It is an actual external deployment action. It never substitutes a preview build for an approved live deployment.

Pull the selected project's production settings into ignored .vercel/ using the authorized account before running the local Vercel build. The local ignored snapshot/legal/evidence files are available to the gated build and are not uploaded as source. Inspect the actual .vercel/output artifact before deployment; out/ alone is not a Node-function bundle. Remote Git builds require a separate secure process to obtain the ignored reviewed files and cannot rely on a normal checkout.

The frontend is static; inquiry and email-worker endpoints run in the selected Supabase project, with the actual Vercel origin allowed server-side.

## Optional Cloudflare Pages

wrangler.jsonc is the Pages configuration: pages_build_output_dir='./out', pinned compatibility_date=2026-10-03. Wrangler is pinned to 4.147.0 in package-lock.json. This is static Next export, not a Next server/Workers adapter.

Use an existing client-owned Free Pages project. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PROJECT_NAME and CLOUDFLARE_PRODUCTION_BRANCH to its actual settings. The branch must match the project's configured production branch; the current Git feature branch is never silently treated as production. Authenticate the authorized account through Wrangler OAuth or a scoped token. The deployment command does not create accounts, change plans, add cards or request login.

Before deployment, verify the current account's shared build/request/storage limits, all other projects and the existing launch evidence. The existing post-build gate checks recorded capacity evidence; it does not independently prove the owner's current plan or every concurrent account action.

```powershell
npm run deploy:cloudflare
```

This optional command requires HOSTING_PROVIDER=cloudflare and matching reviewed Cloudflare evidence before any build/deploy, performs the entire production build and gate again, then invokes wrangler pages deploy out with the explicit project and production branch. Vercel evidence cannot authorize a Cloudflare deployment. It is an actual external deployment action; running production:check or check:pages does not deploy. If deploying the reviewed out/ with a different procedure, keep the same gates and exact account/branch checks.

For Git-connected Pages, use npm run build:production and output out/. Supply the same actual environment and reviewed ignored snapshot/legal/evidence files through the private build process; a normal checkout cannot obtain ignored files by itself. Do not configure npm run build as the production command.

Legacy Cloudflare build-hook automation is disabled before any hook request: accepting a hook never proved that its deployment completed. Use the gated manual deploy:cloudflare command or the verified opt-in Vercel workflow. No callback system, schedule or additional service is enabled.

## Thaimora runtime

Deploy both api and deliver-email Supabase functions after applying the complete reviewed migrations to the selected project. Configure Turnstile real site/secret keys, actual TURNSTILE_HOSTNAMES, random RATE_LIMIT_SALT/EMAIL_WORKER_SECRET, Resend approved sender/recipient and the secure email worker schedule. The preflight rejects documented Turnstile test site keys.

Hosted checks must prove admin Auth membership, sanitized image upload and Storage policies, exact-coordinate privacy, inquiry idempotency, worker email delivery and backup restoration using the hosted PostgreSQL version. The 500 real authorized Phuket listings, their gallery rights and production legal approval must exist before launch. SQL fixtures and licensed OSM POIs never satisfy the property count.

## Opt-in Vercel rebuild automation

.github/workflows/deploy-vercel.yml is a private-repository, manually dispatchable deployment job. It stays disabled unless AUTOMATION_ENABLED=true and HOSTING_PROVIDER=vercel are explicitly set in repository variables. No schedule, repository, secret, project or deployment was enabled by these files.

The existing export job first checks the actual shared Actions budget and exports a production public snapshot. request-rebuild.ts compares the data hash; for Vercel it sends a pinned GitHub workflow_dispatch request using GITHUB_REPOSITORY, explicit GITHUB_DEPLOY_REF and private GITHUB_DEPLOY_TOKEN. That token needs permission to dispatch this repository's workflow; it is separate from the read-only budget token. An accepted request is recorded as running with requested:true,deployed:false. A matching running request is deduplicated for 30 minutes, then the unchanged hash can be requested again. Historical completed rows with deployed:false never suppress retry.

The deploy job checks the same shared Actions budget, installs Vercel CLI 50.38.3 in an ignored CI workspace, copies supplied reviewed PRODUCTION_LEGAL_JSON and PRODUCTION_LAUNCH_EVIDENCE_JSON into private ignored files, pulls the explicitly selected Vercel project's production settings, exports the current sanitized catalog from the actual database, then builds and deploys the prebuilt artifact with every launch gate. Only after the deployment process succeeds does it record a completed/deployed:true receipt for the exact snapshot hash captured before the build. A failed deployment cannot complete that hash; a failed receipt write also fails the job and leaves retry available. This receipt records deployment completion, not provider UAT. scripts/prepare-production-build.mjs preserves supplied evidence; it never invents legal, rights, entitlement or UAT approval. No raw catalogs, environment file, legal/evidence secret file or private key is uploaded as a GitHub artifact.

Populate the exact encrypted secrets and nonsecret repository variables listed in the workflow after the corresponding accounts/configuration are verified. Vercel runtime API_BASE_URL and Supabase function secrets must already be set in their respective platforms. Missing credentials, legal evidence, plan entitlement, actual inventory, budget evidence or project link makes the job fail closed.

## Host observations and internal caps

scripts/launch-evidence.example.json starts with false approvals and null observations. hostingProvider is explicit; observed host plan, commercial permission, free-cost entitlement and quota evidence must come from the actual selected account. Hosting observations need hostingUsageVerified=true, a nonsecret hostingUsageEvidence receipt reference and hostingUsageObservedAt within the preceding 24 hours. An old/future/missing observation cannot certify launch. Update private CI evidence from an actual account check; no script refreshes its timestamp to hide stale evidence.

For Cloudflare, the original documented 20,000-file and 500/month build checks remain provider checks. For Vercel, a 20,000-public-file ceiling and 500-monthly-deployment-record ceiling with a 20-record reserve are internal project guards, not claimed Vercel limits. observedMonthlyDeploymentCount must be the selected account's actually observed current-month deployment-record count across its projects. Deployment records do not prove billable build time, request usage or all retry/concurrent costs. The selected Vercel plan's actual quotas/charges still require the separate fresh host observation. Hobby cannot satisfy this commercial launch even if someone changes approval booleans.

## Reproducible native dependency installation

The previous lock omitted rolldown's native optional binding metadata. Adding the deployment dependency exposed Vitest's native-binding startup error. Metadata was regenerated in an isolated ignored workspace, preserving every existing package version, then a clean Windows npm ci installed binding-win32-x64-msvc 1.2.12. The recorded lock includes all platform variants. Windows unit suites passed after that clean installation; Linux/macOS native execution is not claimed. Do not run npm install against a partial existing node_modules tree to regenerate these optional entries; use the reviewed lock with npm ci.

## Dependency audit — checked 2026-10-03

npm audit --omit=dev --ignore-scripts reports zero production-package vulnerabilities for this local lockfile. Full audit still reports five high affected development packages from one braces stack-exhaustion advisory, GHSA-vfj7-8cjw-p6xm. Current registry versions: eslint-config-next/@next/eslint-plugin-next 16.3.8, micromatch 4.0.8, braces 3.0.3. GitHub advisory's first_patched_version is null at inspection.

npm's suggested eslint-config-next 14.2.35 change is a major downgrade, not a verified compatible fix for Next 16. No downgrade, package substitution, audit suppression or false zero-vulnerability claim was made. Keep lint inputs controlled, monitor upstream and rerun the full audit when a compatible patch exists. This is a development-tool limitation, not a live runtime test or security certification.

References: https://developers.cloudflare.com/pages/functions/wrangler-configuration/ ; https://developers.cloudflare.com/pages/functions/routing/ ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
