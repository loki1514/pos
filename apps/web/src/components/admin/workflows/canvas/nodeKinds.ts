/**
 * The vocabulary of the operations canvas.
 *
 * Two families of block:
 *
 *   FLOW    — sign-in, branch, approval, automation, end. Fixed set.
 *   MODULE  — one block per module in the registry (Orders, POS, KOT, …),
 *             generated from the `modules` table at runtime, NOT hardcoded.
 *
 * That second part is the point: the builder must speak in the product's own
 * nouns. A canvas offering "Trigger → Step → End" describes nothing; a canvas
 * offering "Sign in → POS Billing → Kitchen (KOT)" describes the restaurant.
 *
 * Every kind still maps down to a `WorkflowNodeType` so saved JSON validates
 * against definition.ts and keeps version-bumping through saveWorkflow().
 */
import type { WorkflowNodeType } from "../definition";

export type NodeKindSpec = {
  kind: string;
  label: string;
  blurb: string;
  type: WorkflowNodeType;
  accent: string;
  group: "Flow" | "Modules" | "Access";
  /** Present on module blocks — the registry key it represents. */
  moduleKey?: string;
  /** Submodules available inside that module, for the inspector's tick list. */
  submodules?: { key: string; name: string }[];
};

/** Fixed control-flow blocks. */
export const FLOW_KINDS: NodeKindSpec[] = [
  {
    kind: "signin",
    label: "Sign in",
    blurb: "Where every journey starts — a role signs in.",
    type: "trigger",
    accent: "#4c93e8",
    group: "Flow",
  },
  {
    kind: "rule",
    label: "Branch",
    blurb: "Split the flow on a condition — amount over ₹500, dine-in vs QR.",
    type: "condition",
    accent: "#a855f7",
    group: "Flow",
  },
  {
    kind: "approval",
    label: "Approval",
    blurb: "A role must approve before the flow continues.",
    type: "step",
    accent: "#f2a93b",
    group: "Flow",
  },
  {
    kind: "automation",
    label: "Automation",
    blurb: "Fires without a human — notify, escalate, auto-approve.",
    type: "action",
    accent: "#14b8a6",
    group: "Flow",
  },
  {
    kind: "end",
    label: "Done",
    blurb: "The journey finishes here.",
    type: "end",
    accent: "#6c7267",
    group: "Flow",
  },
];

/** Per-module accents so the canvas is scannable by colour. */
const MODULE_ACCENT: Record<string, string> = {
  dashboard: "#8b5cf6",
  orders: "#b4ee2a",
  pos: "#3b82f6",
  kds_kot: "#f97316",
  menu: "#ec4899",
  inventory: "#14b8a6",
  finance: "#eab308",
  marketing_crm: "#06b6d4",
  staff: "#64748b",
  settings: "#94a3b8",
};

export type ModuleInput = {
  key: string;
  name: string;
  submodules?: { key: string; name: string }[] | null;
  /** False when the org has this module switched off — shown but not offered. */
  enabled?: boolean;
};

/** Build the module half of the palette from the live registry. */
export function moduleKinds(modules: ModuleInput[]): NodeKindSpec[] {
  return modules.map((m) => ({
    kind: `module:${m.key}`,
    label: m.name,
    blurb: `${m.name} — ${(m.submodules ?? []).length} screens`,
    type: "state" as WorkflowNodeType,
    accent: MODULE_ACCENT[m.key] ?? "#79bc0d",
    group: "Modules" as const,
    moduleKey: m.key,
    submodules: m.submodules ?? [],
  }));
}

export function allKinds(modules: ModuleInput[]): NodeKindSpec[] {
  return [...FLOW_KINDS, ...moduleKinds(modules)];
}

export function kindMap(modules: ModuleInput[]): Record<string, NodeKindSpec> {
  return Object.fromEntries(allKinds(modules).map((k) => [k.kind, k]));
}

/** Recover a spec from a persisted node. */
export function specOf(
  node: { type: string; data?: any },
  map: Record<string, NodeKindSpec>,
): NodeKindSpec {
  const fromData = node.data?.kind as string | undefined;
  if (fromData && map[fromData]) return map[fromData];
  return (
    FLOW_KINDS.find((k) => k.type === node.type) ?? FLOW_KINDS[0]
  );
}

// ---------------------------------------------------------------------------
// The default operations flow
// ---------------------------------------------------------------------------

export type RoleAccess = { roleSlug: string; moduleKeys: string[] };

/**
 * Builds the flow this organization *actually* has, from its enabled modules
 * and role permissions — so the canvas opens showing the real operation
 * rather than an empty grid.
 *
 * Shape: Sign in (role) → each module that role can reach → Done.
 * Laid out left-to-right in registry order, which is already the order an
 * operator moves through a shift.
 */
export function buildDefaultFlow(
  modules: ModuleInput[],
  access: RoleAccess | null,
): { nodes: any[]; edges: any[] } {
  const usable = modules.filter(
    (m) =>
      m.enabled !== false &&
      (!access || access.moduleKeys.includes(m.key)),
  );

  const nodes: any[] = [
    {
      id: "signin",
      type: "trigger",
      label: access ? `${access.roleSlug} signs in` : "User signs in",
      data: {
        kind: "signin",
        config: access ? { role: access.roleSlug } : {},
        position: { x: 40, y: 200 },
      },
    },
  ];
  const edges: any[] = [];

  // Fan the modules out in two rows so a 6-module org still fits on screen.
  usable.forEach((m, i) => {
    const col = Math.floor(i / 2);
    const row = i % 2;
    const id = `m_${m.key}`;
    nodes.push({
      id,
      type: "state",
      label: m.name,
      data: {
        kind: `module:${m.key}`,
        config: {
          submodules: (m.submodules ?? []).map((s) => s.key),
          roles: access ? [access.roleSlug] : [],
        },
        position: { x: 300 + col * 240, y: 90 + row * 190 },
      },
    });
    edges.push({ from: "signin", to: id });
  });

  nodes.push({
    id: "done",
    type: "end",
    label: "Done",
    data: {
      kind: "end",
      config: {},
      position: { x: 300 + Math.ceil(usable.length / 2) * 240, y: 200 },
    },
  });

  for (const m of usable) edges.push({ from: `m_${m.key}`, to: "done" });

  return { nodes, edges };
}
