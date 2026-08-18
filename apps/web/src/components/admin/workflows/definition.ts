/**
 * Shared workflow-definition types + validation. Imported by both the
 * client editor and the server actions, so keep it dependency-free.
 */

export type WorkflowNodeType = "trigger" | "step" | "condition" | "end";

export const NODE_TYPES: WorkflowNodeType[] = [
  "trigger",
  "step",
  "condition",
  "end",
];

export type WorkflowNode = {
  id: string;
  type: string;
  label?: string;
  data?: any;
};

export type WorkflowEdge = { from: string; to: string; if?: string };

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export const WORKFLOW_MODULES = ["orders", "pos", "kot", "inventory"] as const;
export type WorkflowModule = (typeof WORKFLOW_MODULES)[number];

export function emptyDefinition(): WorkflowDefinition {
  return {
    nodes: [{ id: "n1", type: "trigger", label: "Start" }],
    edges: [],
  };
}

/**
 * Validates a parsed definition. Returns an error message, or null when the
 * definition is valid. Rules (also enforced client-side in the editor):
 *  - must parse to an object with nodes[] / edges[]
 *  - node ids are non-empty, unique strings
 *  - node type is one of trigger | step | condition | end
 *  - exactly one trigger node
 *  - every edge endpoint references an existing node
 */
export function validateDefinition(def: unknown): string | null {
  if (typeof def !== "object" || def === null || Array.isArray(def)) {
    return "Definition must be a JSON object with nodes and edges.";
  }
  const { nodes, edges } = def as Record<string, unknown>;

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return "Definition needs at least one node.";
  }
  if (!Array.isArray(edges)) {
    return "Definition edges must be an array.";
  }

  const ids = new Set<string>();
  let triggers = 0;
  for (const [i, node] of nodes.entries()) {
    if (typeof node !== "object" || node === null) {
      return `Node #${i + 1} must be an object.`;
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== "string" || !n.id.trim()) {
      return `Node #${i + 1} needs a non-empty string id.`;
    }
    if (ids.has(n.id)) return `Duplicate node id "${n.id}".`;
    ids.add(n.id);
    if (!NODE_TYPES.includes(n.type as WorkflowNodeType)) {
      return `Node "${n.id}" has an invalid type — use trigger, step, condition or end.`;
    }
    if (n.type === "trigger") triggers += 1;
  }
  if (triggers !== 1) {
    return `Definition must have exactly one trigger node (found ${triggers}).`;
  }

  for (const [i, edge] of edges.entries()) {
    if (typeof edge !== "object" || edge === null) {
      return `Edge #${i + 1} must be an object.`;
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.from !== "string" || !ids.has(e.from)) {
      return `Edge #${i + 1} "from" must reference an existing node.`;
    }
    if (typeof e.to !== "string" || !ids.has(e.to)) {
      return `Edge #${i + 1} "to" must reference an existing node.`;
    }
    if (e.from === e.to) return `Edge #${i + 1} loops onto itself.`;
  }

  return null;
}

/** Parses a JSON string into a validated definition. */
export function parseDefinition(json: string): {
  definition: WorkflowDefinition | null;
  error: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return {
      definition: null,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "parse failed"}`,
    };
  }
  const error = validateDefinition(parsed);
  if (error) return { definition: null, error };
  return { definition: parsed as WorkflowDefinition, error: null };
}

export function slugIsValid(key: string): boolean {
  return /^[a-z][a-z0-9_]{1,63}$/.test(key);
}

/**
 * Layers nodes by longest distance from the trigger for the step-flow
 * preview. Unreachable nodes are appended after the last layer.
 */
export function layerNodes(def: WorkflowDefinition): WorkflowNode[][] {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const trigger = def.nodes.find((n) => n.type === "trigger") ?? def.nodes[0];

  const depth = new Map<string, number>([[trigger.id, 0]]);
  // Bellman-Ford-ish relaxation, bounded so cycles can't spin forever.
  for (let pass = 0; pass < def.nodes.length; pass++) {
    let changed = false;
    for (const e of def.edges) {
      if (e.to === trigger.id) continue; // trigger stays pinned at layer 0
      const d = depth.get(e.from);
      if (d !== undefined && (depth.get(e.to) ?? -1) < d + 1) {
        depth.set(e.to, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const maxDepth = Math.max(0, ...depth.values());
  const layers: WorkflowNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  const strays: WorkflowNode[] = [];
  for (const n of def.nodes) {
    const d = depth.get(n.id);
    if (d === undefined) strays.push(n);
    else layers[d].push(n);
  }
  if (strays.length) layers.push(strays);
  return layers.filter((l) => l.length > 0);
}

export function edgeLabel(def: WorkflowDefinition, nodeId: string): string | null {
  const inbound = def.edges.filter((e) => e.to === nodeId && e.if);
  if (!inbound.length) return null;
  return inbound.map((e) => e.if).join(" / ");
}

export function byId(def: WorkflowDefinition) {
  return new Map(def.nodes.map((n) => [n.id, n]));
}
