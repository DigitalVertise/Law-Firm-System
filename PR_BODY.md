feat(ai-workforce-mvp): add AI Law Workforce MVP (isolated)

Summary
- Adds a safe, minimal AI workforce vertical slice:
  - Agent interface and 4 agent stubs (legal research, document drafting, matter support, client service)
  - LLM provider adapter + MockLLMProvider
  - AgentRunner with capability checks, timeouts, and audit logging
  - WhatsApp webhook router with HMAC signature validation, duplicate detection, normalization, routing to client-service agent, and approval enqueueing
  - DurableStore and InMemoryStore abstraction for duplicate detection and approvals
  - ApprovalQueue abstraction and simple audit persister
  - Jest tests covering agent runner, signature validation, and duplicate detection
  - .env.example and docs/ai-workforce/README.md

Security considerations
- No provider credentials or secrets are committed.
- All outbound actions require explicit approval; approvals are recorded and durable.
- Inbound messages are validated and treated as untrusted.
- Agents never claim legal advice; document drafts include a clear advisory note.

Missing credentials / pending integrations
- LLM provider production adapter (e.g., OpenAI/Anthropic) needs to be implemented and configured via secrets.
- Durable store production implementation (Redis/Supabase/Postgres) required.
- Integration with MOLMS DB/API: use existing data access patterns to fetch matter data and user context.
- WhatsApp/Twilio adapter specifics: payload parsing and signature format must be adapted to provider.

Testing
- Run `npm ci && npm test`
- Unit tests included for core behaviors. Integration tests must be added when external services are available.

Rollback
- Do not merge into main without explicit approval.
- To revert: close PR and delete branch feat/ai-law-workforce-mvp.
- If deployed to a staging environment, disable webhook endpoint and revoke provider webhook subscriptions.

How to review
- Start with src/agents and src/adapters to understand interfaces
- Verify whitelist of capabilities enforced in AgentRunner
- Verify webhook signature validation and duplicate detection in integrations/whatsapp
- Confirm no secrets in repo, and that .env.example contains placeholders only

Reviewer checklist
- [ ] No secrets committed
- [ ] Approval flow present for outbound actions
- [ ] Durable store integration plan documented
- [ ] MOLMS data access usage planned / not duplicated
