"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LoaderCircle, Sparkles, Trash2, Wand2 } from "lucide-react";
import {
  FLOW_KINDS,
  buildDefaultFlow,
  kindMap,
  moduleKinds,
  specOf,
  type ModuleInput,
  type NodeKindSpec,
  type RoleAccess,
} from "./nodeKinds";
import type { WorkflowDefinition } from "../definition";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";

type FlowNodeData = {
  kind: string;
  label: string;
  config?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Node card
// ---------------------------------------------------------------------------

function makeNodeComponent(map: Record<string, NodeKindSpec>) {
  return function ConfigNode({ data, selected }: NodeProps) {
    const d = data as FlowNodeData;
    const spec = map[d.kind] ?? FLOW_KINDS[0];
    const c = (d.config ?? {}) as Record<string, any>;

    // Module blocks show what's actually switched on inside them — the whole
    // point is that the canvas reflects real configuration.
    const subs: string[] = c.submodules ?? [];
    const roles: string[] = c.roles ?? [];

    return (
      <div
        className={cn(
          "w-[196px] rounded-[14px] border bg-[var(--canvas)] shadow-sm",
          selected && "shadow-[0_0_0_2px_var(--lime-deep)]",
        )}
        style={{ borderColor: selected ? "var(--lime-deep)" : "var(--line-strong)" }}
      >
        {spec.kind !== "signin" && (
          <Handle
            type="target"
            position={Position.Left}
            style={{
              width: 14,
              height: 14,
              background: "var(--canvas)",
              border: `2.5px solid ${spec.accent}`,
            }}
          />
        )}

        <div
          className="flex items-center gap-2 rounded-t-[13px] px-3 py-1.5"
          style={{ background: `${spec.accent}22` }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: spec.accent }} />
          <span
            className="truncate text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: spec.accent }}
          >
            {spec.group === "Modules" ? "Module" : spec.label}
          </span>
        </div>

        <div className="px-3 py-2">
          <div className="truncate text-[13.5px] font-bold leading-tight">
            {d.label || spec.label}
          </div>

          {spec.group === "Modules" && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {subs.slice(0, 3).map((k) => {
                const name = spec.submodules?.find((s) => s.key === k)?.name ?? k;
                return (
                  <span
                    key={k}
                    className="rounded-full bg-[rgb(18_21_15_/_0.08)] px-1.5 py-0.5 text-[9.5px] font-bold"
                  >
                    {name}
                  </span>
                );
              })}
              {subs.length > 3 && (
                <span className="text-[9.5px] font-bold text-muted">
                  +{subs.length - 3}
                </span>
              )}
              {subs.length === 0 && (
                <span className="text-[10px] text-muted">no screens picked</span>
              )}
            </div>
          )}

          {roles.length > 0 && (
            <div className="mt-1.5 truncate text-[10px] text-muted">
              {roles.join(", ")}
            </div>
          )}

          {spec.kind === "rule" && c.expression && (
            <div className="mt-1 truncate text-[11px] text-muted">{c.expression}</div>
          )}
          {spec.kind === "approval" && c.role && (
            <div className="mt-1 truncate text-[11px] text-muted">by {c.role}</div>
          )}
          {spec.kind === "signin" && c.role && (
            <div className="mt-1 truncate text-[11px] text-muted">as {c.role}</div>
          )}
        </div>

        {spec.kind !== "end" && (
          <Handle
            type="source"
            position={Position.Right}
            title="Drag from here to another block"
            style={{
              width: 14,
              height: 14,
              background: spec.accent,
              border: "2.5px solid var(--canvas)",
              cursor: "crosshair",
            }}
          />
        )}
      </div>
    );
  };
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

function CanvasInner({
  initial,
  roles,
  modules,
  roleAccess,
  onChange,
}: {
  initial: WorkflowDefinition;
  roles: { slug: string; name: string }[];
  modules: ModuleInput[];
  roleAccess: RoleAccess[];
  onChange: (def: WorkflowDefinition) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const idSeq = useRef(1);

  const map = useMemo(() => kindMap(modules), [modules]);
  const nodeTypes = useMemo(() => ({ config: makeNodeComponent(map) }), [map]);
  const modKinds = useMemo(() => moduleKinds(modules), [modules]);

  const toFlow = useCallback(
    (def: WorkflowDefinition) => {
      const ns: Node[] = def.nodes.map((n, i) => {
        const spec = specOf(n, map);
        const pos = (n.data?.position as { x: number; y: number } | undefined) ?? {
          x: 80 + i * 220,
          y: 120,
        };
        return {
          id: n.id,
          type: "config",
          position: pos,
          data: { kind: spec.kind, label: n.label ?? spec.label, config: n.data?.config ?? {} },
        };
      });
      const es: Edge[] = def.edges.map((e, i) => ({
        id: `e${i}_${e.from}_${e.to}`,
        source: e.from,
        target: e.to,
        label: e.if,
        animated: Boolean(e.if),
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      }));
      return { ns, es };
    },
    [map],
  );

  const seed = useMemo(() => toFlow(initial), [initial, toFlow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.ns);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.es);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const publish = useCallback(
    (ns: Node[], es: Edge[]) => {
      onChange({
        nodes: ns.map((n) => {
          const d = n.data as FlowNodeData;
          const spec = map[d.kind] ?? FLOW_KINDS[0];
          return {
            id: n.id,
            type: spec.type,
            label: d.label,
            data: { kind: d.kind, config: d.config ?? {}, position: n.position },
          };
        }),
        edges: es.map((e) => ({
          from: e.source,
          to: e.target,
          ...(typeof e.label === "string" && e.label ? { if: e.label } : {}),
        })),
      });
    },
    [map, onChange],
  );

  const sync = useCallback(
    (ns: Node[], es: Edge[]) => {
      setNodes(ns);
      setEdges(es);
      publish(ns, es);
    },
    [publish, setNodes, setEdges],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      haptic("light");
      setEdges((eds: Edge[]) => {
        const next = addEdge(
          {
            ...c,
            id: `e${Date.now()}`,
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          },
          eds,
        );
        publish(nodes, next);
        return next;
      });
    },
    [nodes, publish, setEdges],
  );

  const addNodeOfKind = useCallback(
    (kind: string, position: { x: number; y: number }) => {
      const spec = map[kind];
      if (!spec) return;
      const node: Node = {
        id: `n${Date.now()}_${idSeq.current++}`,
        type: "config",
        position,
        data: {
          kind: spec.kind,
          label: spec.label,
          // A module block arrives with all its screens on — the common case
          // is "this org uses this module", not "none of it".
          config: spec.moduleKey
            ? { submodules: (spec.submodules ?? []).map((s) => s.key), roles: [] }
            : {},
        },
      };
      haptic("medium");
      sync([...nodes, node], edges);
      setSelectedId(node.id);
    },
    [edges, map, nodes, sync],
  );

  const addAtCentre = useCallback(
    (kind: string) => {
      const box = wrapper.current?.getBoundingClientRect();
      const centre = box
        ? screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
        : { x: 140, y: 140 };
      const off = (nodes.length % 5) * 28;
      addNodeOfKind(kind, { x: centre.x + off, y: centre.y + off });
    },
    [addNodeOfKind, nodes.length, screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/vini-node");
      if (!kind || !map[kind]) return;
      addNodeOfKind(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addNodeOfKind, map, screenToFlowPosition],
  );

  /** Rebuild the canvas from what this org actually has configured. */
  const generate = useCallback(
    (access: RoleAccess | null) => {
      haptic("medium");
      const def = buildDefaultFlow(modules, access);
      const { ns, es } = toFlow(def as WorkflowDefinition);
      sync(ns, es);
      setSelectedId(null);
    },
    [modules, sync, toFlow],
  );

  /** Plain English → graph. Server re-validates every key against the live
   *  registry, so a bad generation can only be small, never invalid. */
  const describe = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/workflow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Could not generate that.");
        haptic("warn");
        return;
      }
      const { ns, es } = toFlow(data.definition as WorkflowDefinition);
      sync(ns, es);
      setSelectedId(null);
      haptic("success");
    } catch {
      setGenError("Could not reach the generator.");
      haptic("warn");
    } finally {
      setGenerating(false);
    }
  }, [generating, prompt, sync, toFlow]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const updateSelected = useCallback(
    (patch: Partial<FlowNodeData>) => {
      sync(
        nodes.map((n) =>
          n.id === selectedId ? { ...n, data: { ...(n.data as FlowNodeData), ...patch } } : n,
        ),
        edges,
      );
    },
    [edges, nodes, selectedId, sync],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    haptic("warn");
    sync(
      nodes.filter((n) => n.id !== selectedId),
      edges.filter((e) => e.source !== selectedId && e.target !== selectedId),
    );
    setSelectedId(null);
  }, [edges, nodes, selectedId, sync]);

  const paneH = "h-[calc(100dvh-19rem)] min-h-[420px]";

  return (
    <div className="space-y-3">
      {/* Always visible: describing the flow is a canvas-level action, not
          something that should disappear when a block is selected. */}
      <div className="glass-inset rounded-[14px] p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="t-label shrink-0 text-muted">Describe it</span>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") describe();
            }}
            placeholder="Captain takes the order, kitchen cooks it, biller settles. Discounts over ₹500 need the manager."
            className="glass-inset h-10 flex-1 rounded-[11px] px-3 text-[13px] outline-none placeholder:text-muted/70 focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]"
          />
          <button
            type="button"
            onClick={describe}
            disabled={!prompt.trim() || generating}
            className="press btn-lime inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-4 text-[13px] font-extrabold disabled:opacity-45"
          >
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {generating ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" /> Building…
                </>
              ) : (
                <>
                  <Wand2 size={14} strokeWidth={2.8} /> Build flow
                </>
              )}
            </span>
          </button>
        </div>
        {genError && (
          <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{genError}</p>
        )}
      </div>

    <div className="grid gap-3 lg:grid-cols-[220px_1fr_300px]">
      {/* Palette */}
      <div className={cn("glass-inset scroll-thin overflow-y-auto rounded-[14px] p-2.5", paneH)}>
        <div className="t-label mb-1.5 px-1 text-muted">Modules</div>
        <p className="mb-2 px-1 text-[11px] leading-snug text-muted">
          The screens this platform actually has. Drop one in, then tick which
          of its screens this flow uses.
        </p>
        <div className="space-y-1">
          {modKinds.map((k) => (
            <PaletteItem key={k.kind} spec={k} onAdd={() => addAtCentre(k.kind)} />
          ))}
        </div>

        <p className="mt-3 rounded-[9px] bg-[rgb(18_21_15_/_0.05)] px-2 py-1.5 text-[10.5px] leading-snug text-muted">
          <span className="font-bold">To connect:</span> drag from the filled
          dot on a block&apos;s right edge onto the hollow ring on another
          block&apos;s left edge.
        </p>

        <div className="t-label mb-1.5 mt-4 px-1 text-muted">Flow</div>
        <div className="space-y-1">
          {FLOW_KINDS.map((k) => (
            <PaletteItem key={k.kind} spec={k} onAdd={() => addAtCentre(k.kind)} />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapper}
        className={cn("glass-inset overflow-hidden rounded-[14px]", paneH)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(c: Parameters<typeof onNodesChange>[0]) => {
            onNodesChange(c);
            queueMicrotask(() => publish(nodes, edges));
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_: React.MouseEvent, n: Node) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-transparent" style={{ width: 130, height: 84 }} />
        </ReactFlow>
      </div>

      {/* Inspector */}
      <div className={cn("glass-inset scroll-thin overflow-y-auto rounded-[14px] p-3", paneH)}>
        {!selected ? (
          <div className="space-y-3">
            <div className="t-label text-muted">Build from real config</div>
            <p className="text-[12px] leading-snug text-muted">
              Generate the flow this organization already has — sign-in, the
              modules it has switched on, and the screens each role can reach.
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => generate(null)}
                className="press btn-lime flex w-full items-center justify-center gap-1.5 rounded-[11px] px-3 py-2 text-[12.5px] font-extrabold"
              >
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Sparkles size={13} strokeWidth={2.8} />
                  All enabled modules
                </span>
              </button>
              {roleAccess.map((ra) => {
                const role = roles.find((r) => r.slug === ra.roleSlug);
                return (
                  <button
                    key={ra.roleSlug}
                    type="button"
                    onClick={() => generate(ra)}
                    className="press glass-inset flex w-full items-center justify-between rounded-[11px] px-3 py-2 text-left text-[12.5px] font-bold hover:text-ink"
                  >
                    <span>{role?.name ?? ra.roleSlug}</span>
                    <span className="text-[10.5px] text-muted">
                      {ra.moduleKeys.length} modules
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="border-t border-[var(--line)] pt-3 text-[11.5px] leading-snug text-muted">
              Or click a block on the canvas to configure it.
            </p>
          </div>
        ) : (
          <Inspector
            data={selected.data as FlowNodeData}
            spec={map[(selected.data as FlowNodeData).kind] ?? FLOW_KINDS[0]}
            roles={roles}
            onChange={updateSelected}
            onDelete={deleteSelected}
          />
        )}
      </div>
    </div>
    </div>
  );
}

function PaletteItem({ spec, onAdd }: { spec: NodeKindSpec; onAdd: () => void }) {
  return (
    <button
      type="button"
      draggable
      onClick={onAdd}
      title={`${spec.blurb} — drag onto the canvas, or click to add`}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/vini-node", spec.kind);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="press flex w-full cursor-grab items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] font-bold hover:bg-[rgb(18_21_15_/_0.05)] active:cursor-grabbing"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: spec.accent }} />
      <span className="truncate">{spec.label}</span>
    </button>
  );
}

function Inspector({
  data,
  spec,
  roles,
  onChange,
  onDelete,
}: {
  data: FlowNodeData;
  spec: NodeKindSpec;
  roles: { slug: string; name: string }[];
  onChange: (patch: Partial<FlowNodeData>) => void;
  onDelete: () => void;
}) {
  const config = (data.config ?? {}) as Record<string, any>;
  const setConfig = (patch: Record<string, unknown>) =>
    onChange({ config: { ...config, ...patch } });

  const FIELD =
    "glass-inset h-9 w-full rounded-[10px] px-2.5 text-[13px] font-medium outline-none focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

  function toggleIn(key: string, value: string) {
    const list: string[] = config[key] ?? [];
    setConfig({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: spec.accent }} />
        <span className="t-label truncate text-muted">{spec.label}</span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove block"
          className="press ml-auto inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted hover:text-[var(--danger)]"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div>
        <label className="t-label mb-1 block text-muted" style={{ fontSize: 10 }}>
          Label
        </label>
        <input
          value={data.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className={FIELD}
        />
      </div>

      {(spec.kind === "signin" || spec.kind === "approval") && (
        <div>
          <label className="t-label mb-1 block text-muted" style={{ fontSize: 10 }}>
            Role
          </label>
          <select
            value={config.role ?? ""}
            onChange={(e) => setConfig({ role: e.target.value })}
            className={FIELD}
          >
            <option value="">Any role</option>
            {roles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Module block: which screens, and who reaches them */}
      {spec.moduleKey && (
        <>
          <TickList
            title="Screens in this module"
            items={(spec.submodules ?? []).map((s) => ({ value: s.key, label: s.name }))}
            checked={config.submodules ?? []}
            onToggle={(v) => toggleIn("submodules", v)}
          />
          <TickList
            title="Roles that reach it here"
            items={roles.map((r) => ({ value: r.slug, label: r.name }))}
            checked={config.roles ?? []}
            onToggle={(v) => toggleIn("roles", v)}
          />
        </>
      )}

      {spec.kind === "rule" && (
        <div>
          <label className="t-label mb-1 block text-muted" style={{ fontSize: 10 }}>
            Condition
          </label>
          <input
            value={config.expression ?? ""}
            onChange={(e) => setConfig({ expression: e.target.value })}
            placeholder="amount > 500"
            className={FIELD}
          />
          <p className="mt-1 text-[11px] text-muted">
            Label the two outgoing links true / false.
          </p>
        </div>
      )}

      {spec.kind === "automation" && (
        <div>
          <label className="t-label mb-1 block text-muted" style={{ fontSize: 10 }}>
            Action
          </label>
          <select
            value={config.action ?? ""}
            onChange={(e) => setConfig({ action: e.target.value })}
            className={FIELD}
          >
            <option value="">Choose…</option>
            <option value="notify">Notify a role</option>
            <option value="auto_approve">Auto-approve</option>
            <option value="escalate">Escalate</option>
            <option value="print_kot">Print KOT</option>
          </select>
        </div>
      )}
    </div>
  );
}

function TickList({
  title,
  items,
  checked,
  onToggle,
}: {
  title: string;
  items: { value: string; label: string }[];
  checked: string[];
  onToggle: (value: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="t-label mb-1 text-muted" style={{ fontSize: 10 }}>
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((it) => {
          const on = checked.includes(it.value);
          return (
            <label
              key={it.value}
              className="flex cursor-pointer items-center gap-2 rounded-[8px] px-1.5 py-1 text-[12.5px] hover:bg-[rgb(18_21_15_/_0.05)]"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(it.value)}
                className="h-3.5 w-3.5 accent-[var(--lime-deep)]"
              />
              <span className={on ? "font-bold" : "text-muted"}>{it.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function FlowCanvas(props: {
  initial: WorkflowDefinition;
  roles: { slug: string; name: string }[];
  modules: ModuleInput[];
  roleAccess: RoleAccess[];
  onChange: (def: WorkflowDefinition) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
