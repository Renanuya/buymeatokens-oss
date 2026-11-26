import type { User } from "./users";

// There are no subscriptions today: every creator is free. Pages claimed during early access also hold lifetime free
// access, a public commitment (see /about#lifetime-free) that nothing in the code may take away.

export type PlanState = { kind: "lifetime-free"; grantedAt: number } | { kind: "early-access" };

export function planState(user: Pick<User, "lifetimeFreeGrantedAt">): PlanState {
  return user.lifetimeFreeGrantedAt !== null
    ? { kind: "lifetime-free", grantedAt: user.lifetimeFreeGrantedAt }
    : { kind: "early-access" };
}
