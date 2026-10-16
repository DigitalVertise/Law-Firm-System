AI Law Workforce MVP - README

Overview
- Adds an isolated AI workforce feature implemented in feature branch feat/ai-law-workforce-mvp.
- Minimal safe vertical slice implemented:
  - Agent interface and four agent stubs (legal research, drafting, matter support, client service)
  - WhatsApp webhook handler with signature validation, normalization, duplicate protection
  - Audit log and approval queue abstractions
  - Adapters: LLM provider interface + mock
  - In-memory durable store for local testing
  - Tests for key flows

Key principles
- Never modify main directly; work on feature branch.
- Do not commit secrets. Use environment variables or secret managers.
- Require approval before outbound actions.
- Treat inbound data and documents as untrusted.
- Do not expose privileged matter or client data to unauthorized agents.

How to run tests
- Node.js 18+ recommended
- Install: npm ci
- Run tests: npm test (Jest)
- On CI, inject real DurableStore implementation and LLM provider via environment variables

Webhook configuration
- Expose POST /ai/whatsapp/webhook (or mount router) in a secure, authenticated endpoint
- Configure WHATSAPP_WEBHOOK_SECRET in provider settings to match environment variable

Missing credentials & integrations
- LLM provider: adapter exists; real provider implementation pending
- Durable store: InMemoryStore included for tests; replace with Redis/Supabase/Postgres in production
- MOLMS DB integration: not duplicated - use existing MOLMS data-access layer when connecting

Security & approvals
- All outbound messages and document deliveries MUST go through approval workflow
- Ensure tenant and matter-level access controls are enforced when wiring to the real DB
