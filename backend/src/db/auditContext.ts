import { AsyncLocalStorage } from "node:async_hooks";

type AuditContext = {
  actorUserId: string;
};

const auditContext = new AsyncLocalStorage<AuditContext>();

export function runWithAuditActor(
  actorUserId: string,
  fn: () => void
): void {
  auditContext.run(
    {
      actorUserId,
    },
    fn
  );
}

export function getAuditActorUserId(): string | undefined {
  return auditContext.getStore()?.actorUserId;
}
