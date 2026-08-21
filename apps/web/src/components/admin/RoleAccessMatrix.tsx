"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Check,
  Lock,
  LoaderCircle,
  ShieldAlert,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  saveRoleAccessAction,
  type PendingChange,
  type RoleAccessState,
} from "@/app/admin/roles/actions";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";

export type MatrixRole = { id: string; slug: string; name: string };
export type MatrixModule = { key: string; name: string; is_core: boolean };

const INITIAL: RoleAccessState = { ok: false, error: null, applied: 0 };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="press btn-lime inline-flex h-11 items-center gap-2 rounded-[13px] px-5 text-[14px] font-extrabold disabled:opacity-50"
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {pending ? (
          <>
            <LoaderCircle size={15} className="animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Check size={15} strokeWidth={3} />
            Confirm &amp; save
          </>
        )}
      </span>
    </button>
  );
}

/**
 * Role × module tick-boxes.
 *
 * Ticking stages a change locally — nothing is written until the user opens
 * the review sheet, sees exactly what is about to change, and enters the
 * builder passcode. Permissions are the one thing in the product that should
 * never move on a stray click.
 */
export function RoleAccessMatrix({
  roles,
  modules,
  initial,
  organizationId = null,
  scopeLabel = "All organizations",
  passcodeConfigured,
}: {
  roles: MatrixRole[];
  modules: MatrixModule[];
  /** `${roleId}:${moduleKey}` for every visible pair, as stored. */
  initial: string[];
  organizationId?: string | null;
  scopeLabel?: string;
  passcodeConfigured: boolean;
}) {
  const saved = useMemo(() => new Set(initial), [initial]);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(initial));
  const [reviewing, setReviewing] = useState(false);
  const [state, formAction] = useActionState(saveRoleAccessAction, INITIAL);

  // On success the server revalidates and `initial` comes back matching the
  // draft — close the sheet and re-baseline so nothing shows as unsaved.
  useEffect(() => {
    if (state.ok) {
      setReviewing(false);
      haptic("success");
    }
  }, [state.ok, state.applied]);

  useEffect(() => {
    setDraft(new Set(initial));
  }, [initial]);

  const cellKey = (roleId: string, moduleKey: string) => `${roleId}:${moduleKey}`;

  // Everything that differs from what's stored.
  const changes: (PendingChange & { roleName: string; moduleName: string })[] =
    useMemo(() => {
      const out: (PendingChange & { roleName: string; moduleName: string })[] = [];
      for (const role of roles) {
        for (const mod of modules) {
          const key = cellKey(role.id, mod.key);
          const was = saved.has(key);
          const now = draft.has(key);
          if (was !== now) {
            out.push({
              roleId: role.id,
              moduleKey: mod.key,
              visible: now,
              roleName: role.name,
              moduleName: mod.name,
            });
          }
        }
      }
      return out;
    }, [draft, saved, roles, modules]);

  function toggle(role: MatrixRole, mod: MatrixModule) {
    // An org must always keep someone who can reach Settings and Users.
    if (role.slug === "org_admin") return;

    haptic("light");
    setDraft((prev) => {
      const next = new Set(prev);
      const key = cellKey(role.id, mod.key);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function discard() {
    setDraft(new Set(initial));
    haptic("light");
  }

  // A successful save means the server state now matches the draft.
  const justSaved = state.ok && changes.length === 0;

  return (
    <div className="glass rounded-[var(--r-xl)] p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="t-h3">Who sees what</h2>
          <span className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-[12px] font-bold">
            {scopeLabel}
          </span>
          {changes.length > 0 && (
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-bold"
              style={{ background: "rgb(242 169 59 / 0.16)", color: "var(--warn)" }}
            >
              {changes.length} unsaved
            </span>
          )}
        </div>

        <p className="mt-2 max-w-2xl t-small text-muted">
          Tick a box to let that role open that module. Nothing saves until you
          review and confirm. The organization must also have the module
          switched on — both have to be true, or nobody sees it.
        </p>

        {!passcodeConfigured && (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
            style={{
              background: "rgb(242 169 59 / 0.12)",
              color: "var(--warn)",
              border: "1px solid rgb(242 169 59 / 0.28)",
            }}
          >
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            Builder passcode isn&apos;t configured, so permissions can&apos;t be
            changed. Set <code>ADMIN_BUILDER_PASSCODE</code> in the environment.
          </div>
        )}

        {justSaved && (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
            style={{
              background: "rgb(79 191 106 / 0.12)",
              color: "var(--ok)",
              border: "1px solid rgb(79 191 106 / 0.28)",
            }}
          >
            <Check size={14} strokeWidth={3} className="mt-0.5 shrink-0" />
            Saved. {state.applied} permission{state.applied === 1 ? "" : "s"} updated.
          </div>
        )}

        {/* Matrix */}
        <div className="scroll-thin mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="t-label px-3 py-2.5 font-bold text-muted">Module</th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    scope="col"
                    className="t-label px-3 py-2.5 text-center font-bold text-muted"
                  >
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.key} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="text-[13.5px] font-bold">{m.name}</span>
                    {m.is_core && (
                      <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wide text-muted">
                        core
                      </span>
                    )}
                  </td>

                  {roles.map((r) => {
                    const key = cellKey(r.id, m.key);
                    const on = draft.has(key);
                    const dirty = saved.has(key) !== on;
                    const locked = r.slug === "org_admin";

                    return (
                      <td key={r.id} className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          aria-label={`${r.name} — ${m.name}`}
                          aria-pressed={on}
                          disabled={locked}
                          onClick={() => toggle(r, m)}
                          className={cn(
                            "press inline-flex h-7 w-7 items-center justify-center rounded-[9px]",
                            locked && "cursor-not-allowed opacity-45",
                            dirty && "ring-2 ring-[var(--warn)] ring-offset-1",
                          )}
                          style={{
                            background: on
                              ? "linear-gradient(180deg, var(--lime-bright), var(--lime))"
                              : "rgb(18 21 15 / 0.06)",
                            color: on ? "var(--lime-ink)" : "var(--muted)",
                          }}
                        >
                          {locked ? (
                            <Lock size={12} />
                          ) : on ? (
                            <Check size={14} strokeWidth={3.2} />
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <p className="mr-auto t-small text-muted">
            Organization Admin is locked on.
          </p>
          {changes.length > 0 && (
            <>
              <button
                type="button"
                onClick={discard}
                className="press glass-inset inline-flex h-11 items-center gap-2 rounded-[13px] px-4 text-[13.5px] font-bold text-muted hover:text-ink"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={!passcodeConfigured}
                onClick={() => {
                  haptic("medium");
                  setReviewing(true);
                }}
                className="press btn-lime inline-flex h-11 items-center gap-2 rounded-[13px] px-5 text-[14px] font-extrabold disabled:opacity-45"
              >
                <span className="relative z-10">
                  Review {changes.length} change{changes.length === 1 ? "" : "s"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Heads-up before anything is written */}
      {reviewing && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
          <button
            aria-label="Cancel"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setReviewing(false)}
          />

          <div className="glass rise relative z-10 w-full max-w-[520px] rounded-t-[var(--r-2xl)] p-6 sm:rounded-[var(--r-2xl)]">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
                    style={{ background: "rgb(242 169 59 / 0.16)" }}
                  >
                    <ShieldAlert size={17} className="text-[var(--warn)]" />
                  </span>
                  <div>
                    <h3 className="t-h3">Confirm permission changes</h3>
                    <p className="t-small text-muted">
                      Applies to {scopeLabel}.
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Cancel"
                  onClick={() => setReviewing(false)}
                  className="press inline-flex h-9 w-9 items-center justify-center rounded-[11px] text-muted hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="scroll-thin mt-5 max-h-56 space-y-1.5 overflow-y-auto">
                {changes.map((c) => (
                  <li
                    key={`${c.roleId}:${c.moduleKey}`}
                    className="glass-inset flex items-center gap-2.5 rounded-[11px] px-3 py-2 text-[13.5px]"
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
                      style={{
                        background: c.visible
                          ? "rgb(79 191 106 / 0.18)"
                          : "rgb(226 86 75 / 0.14)",
                        color: c.visible ? "var(--ok)" : "var(--danger)",
                      }}
                    >
                      {c.visible ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    </span>
                    <span className="font-bold">{c.roleName}</span>
                    <span className="text-muted">
                      {c.visible ? "can now open" : "can no longer open"}
                    </span>
                    <span className="font-bold">{c.moduleName}</span>
                  </li>
                ))}
              </ul>

              <form action={formAction} className="mt-5 space-y-3">
                <input
                  type="hidden"
                  name="changes"
                  value={JSON.stringify(
                    changes.map(({ roleId, moduleKey, visible }) => ({
                      roleId,
                      moduleKey,
                      visible,
                    })),
                  )}
                />
                <input
                  type="hidden"
                  name="organizationId"
                  value={organizationId ?? "platform"}
                />

                <div>
                  <label htmlFor="passcode" className="t-label mb-1.5 block text-muted">
                    Builder passcode
                  </label>
                  <input
                    id="passcode"
                    name="passcode"
                    type="password"
                    required
                    autoFocus
                    autoComplete="off"
                    placeholder="••••••••"
                    className="glass-inset h-11 w-full rounded-[13px] px-3.5 text-[14.5px] font-medium outline-none focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]"
                  />
                  <p className="mt-1.5 t-small text-muted">
                    A second lock so permissions can&apos;t be changed by accident.
                  </p>
                </div>

                {state.error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px] font-medium"
                    style={{
                      background: "rgb(226 86 75 / 0.1)",
                      color: "var(--danger)",
                      border: "1px solid rgb(226 86 75 / 0.24)",
                    }}
                  >
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    {state.error}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setReviewing(false)}
                    className="press inline-flex h-11 items-center justify-center rounded-[13px] px-4 text-[13.5px] font-bold text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <SaveButton />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
