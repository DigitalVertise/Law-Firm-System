Vercel Deployment Notes

This repository contains a feature branch feat/ai-law-workforce-mvp with code for the AI Law Workforce MVP. To enable automatic deployment to Vercel for preview builds, follow these steps.

1) Create a Vercel Project
- In Vercel (https://vercel.com), create a new project and import the GitHub repository DigitalVertise/Law-Firm-System.
- During setup, configure the project to deploy the appropriate framework or set the build command and output directory.

2) Obtain Vercel identifiers & token
- In the Vercel dashboard for your account or team, create a token (Personal Token) from Settings > Tokens.
- In the Vercel project settings, note the Organization ID and Project ID (you can also obtain these via the Vercel CLI: `vercel projects ls`).

3) Add GitHub repository secrets
- In the GitHub repo (Settings > Secrets and variables > Actions), create the following repository secrets:
  - VERCEL_TOKEN -> the token you created
  - VERCEL_ORG_ID -> your Vercel organization ID
  - VERCEL_PROJECT_ID -> your Vercel project ID

4) Adjust vercel.json if needed
- The repo includes a minimal vercel.json. Adjust the "builds" and "routes" to match your app type (Static, Next.js, Serverless functions, etc.).

5) Trigger a deploy
- Push commits to feat/ai-law-workforce-mvp or open a PR. The GitHub Actions workflow .github/workflows/vercel-deploy.yml will run and create a preview deployment in Vercel.

6) Environment variables
- Set runtime environment variables in the Vercel dashboard (or map GitHub secrets) such as WHATSAPP_WEBHOOK_SECRET, LLM_PROVIDER_API_KEY, SUPABASE_URL, etc.

Notes & security
- Do NOT commit secrets into the repo. Use GitHub Actions secrets and Vercel environment variables.
- The workflow uses amondnet/vercel-action. You can replace it with the official vercel/action if preferred.

