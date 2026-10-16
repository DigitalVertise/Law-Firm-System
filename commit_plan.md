Commit plan (apply on branch feat/ai-law-workforce-mvp):

1. Create branch:
   git checkout -b feat/ai-law-workforce-mvp main

2. Add adapters & interfaces
   - src/agents/AgentInterface.ts
   - src/adapters/llmProvider.ts
   - src/services/auditLog.ts
   - src/store/durableStore.ts

Commit: feat(ai): add agent interfaces, llm adapter, audit and durable store abstractions

3. Add agents and runner
   - src/agents/*.ts (4 agents)
   - src/services/agentRunner.ts

Commit: feat(ai): add agent implementations and runner with capability checks

4. Add whatsapp integration and approval queue
   - src/integrations/whatsapp/* (signatureValidator, webhookHandler)
   - src/services/approvalQueue.ts

Commit: feat(integration): add whatsapp webhook handler, signature validation, approval queue

5. Tests
   - tests/*

Commit: test(ai): add unit tests for agent runner, signature validator, duplicate detection

6. Docs and .env.example
   - docs/ai-workforce/README.md
   - .env.example
   - PR_BODY.md

Commit: docs(ai): add README, .env.example, and PR template body

7. Run tests and fix failures locally.

8. Push branch and open PR:
   git push --set-upstream origin feat/ai-law-workforce-mvp
   Create PR with PR_BODY.md content.

Note: If push is denied, record exact GitHub error and request minimal permission: repo:write or maintain depending on org policy. Do not bypass branch protections.
