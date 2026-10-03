import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: Request) => Promise<Response>),
  tasks: [] as { id: string; inquiry_id: string; attempts: number }[],
  updates: [] as { id: string; value: Record<string, unknown> }[],
  claims: vi.fn(),
}));
vi.mock("../../supabase/functions/_shared/runtime.ts", async () => {
  const { fetchJson } = await import("../../supabase/functions/_shared/http");
  return {
    serve: (handler: typeof state.handler) => { state.handler = handler; },
    env: (name: string) => ({ EMAIL_WORKER_SECRET: "synthetic-worker-secret", RESEND_API_KEY: "synthetic-provider-key", INQUIRY_EMAIL_TO: "test@example.test", INQUIRY_EMAIL_FROM: "sender@example.test" }[name] ?? ""),
    checkDb: (result: { data: unknown; error?: unknown }) => { if (result.error) throw new Error("database_unavailable"); return result.data; },
    json: (value: unknown) => new Response(JSON.stringify(value)),
    fetchJson,
    client: () => ({
      rpc: (name: string, args: unknown) => {
        state.claims(name, args);
        return { abortSignal: async () => ({ data: state.tasks }) };
      },
      from: (table: string) => {
        let id = "";
        let update: Record<string, unknown> | undefined;
        const query = {
          select: () => query,
          update: (value: Record<string, unknown>) => { update = value; return query; },
          eq: (_column: string, value: string) => { id = value; return query; },
          abortSignal: () => {
            if (table === "email_outbox") {
              state.updates.push({ id, value: update! });
              return Promise.resolve({ data: null });
            }
            return query;
          },
          single: async () => ({ data: { id, name: "Synthetic inquiry", email: "guest@example.test", country: "TH", message: "Test only", property_id: "synthetic-property" } }),
        };
        return query;
      },
    }),
  };
});
import "../../supabase/functions/deliver-email/index";

beforeEach(() => {
  state.tasks = [];
  state.updates = [];
  state.claims.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T00:00:00Z"));
  vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), milliseconds);
    return controller.signal;
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const run = (secret = "synthetic-worker-secret") => state.handler!(new Request("https://project.example.test/deliver-email", { method: "POST", headers: { Authorization: `Bearer ${secret}` } }));

test("an unauthorized caller cannot claim inquiry tasks", async () => {
  await expect(run("incorrect")).rejects.toThrow("unauthorized");
  expect(state.claims).not.toHaveBeenCalled();
});

test("a five-task batch accepts six-second provider responses concurrently", async () => {
  state.tasks = Array.from({ length: 5 }, (_, index) => ({ id: `task-${index}`, inquiry_id: `inquiry-${index}`, attempts: 1 }));
  let active = 0, peak = 0;
  const fetch = vi.fn((_url: unknown, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    active++; peak = Math.max(peak, active);
    const onAbort = () => { active--; reject(init.signal!.reason); };
    init.signal!.addEventListener("abort", onAbort, { once: true });
    setTimeout(() => { init.signal!.removeEventListener("abort", onAbort); active--; resolve(new Response('{"id":"synthetic-message"}')); }, 6000);
  }));
  vi.stubGlobal("fetch", fetch);
  const result = run();
  await vi.advanceTimersByTimeAsync(6000);
  expect(await (await result).json()).toEqual({ sent: 5, failed: 0, pendingPreserved: 0 });
  expect(peak).toBe(5);
  expect(state.claims).toHaveBeenCalledWith("claim_email_batch", { p_limit: 5 });
  expect(state.updates.every(({ value }) => value.status === "sent")).toBe(true);
});

test("provider timeout retains delayed work and retry uses the same inquiry idempotency key", async () => {
  state.tasks = [{ id: "task-1", inquiry_id: "inquiry-1", attempts: 2 }];
  const keys: string[] = [];
  vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => {
    keys.push(new Headers(init.headers).get("Idempotency-Key")!);
    return new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true }));
  }));
  const first = run();
  await vi.advanceTimersByTimeAsync(8000);
  expect(await (await first).json()).toEqual({ sent: 0, failed: 1, pendingPreserved: 1 });
  expect(state.updates[0].value).toMatchObject({ status: "failed", last_error: "email_provider_unavailable", next_attempt_at: "2026-10-03T00:04:08.000Z" });
  await vi.advanceTimersByTimeAsync(240000);
  state.tasks[0].attempts = 3;
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    keys.push(new Headers(init.headers).get("Idempotency-Key")!);
    return new Response('{"id":"synthetic-message"}');
  }));
  expect(await (await run()).json()).toMatchObject({ sent: 1, failed: 0 });
  expect(keys).toEqual(["inquiry-inquiry-1", "inquiry-inquiry-1"]);
  expect(state.updates.at(-1)?.value.status).toBe("sent");
});
