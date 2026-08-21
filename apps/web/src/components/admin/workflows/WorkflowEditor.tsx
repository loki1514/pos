"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import {
  Braces,
  Check,
  ListTree,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import {
  saveWorkflowAction,
  type SaveWorkflowState,
} from "@/app/admin/workflows/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import {
  emptyDefinition,
  parseDefinition,
  slugIsValid,
  validateDefinition,
  NODE_TYPES,
  WORKFLOW_MODULES,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowModule,
  type WorkflowNode,
} from "./definition";
import { FlowPreview } from "./FlowPreview";
import { FlowCanvas } from "./canvas/FlowCanvas";
import type { ModuleInput, RoleAccess } from "./canvas/nodeKinds";

const FIELD =
  "glass-inset h-11 w-full rounded-[13px] px-3.5 text-[14.5px] font-medium " +
  "outline-none transition-shadow placeholder:text-muted/70 " +
  "focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

const FIELD_SM =
  "glass-inset h-9 w-full rounded-[10px] px-3 text-[13px] font-medium " +
  "outline-none transition-shadow placeholder:text-muted/70 " +
  "focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

const LABEL = "t-label mb-1.5 block text-muted";

const INITIAL_STATE: SaveWorkflowState = {
  ok: false,
  error: null,
  savedKey: null,
};

export type EditorTarget =
  | { mode: "create" }
  | {
      mode: "edit";
      /** Row id of the version being edited — saveWorkflow bumps from it. */
      id: string;
      key: string;
      name: string;
      module: string;
      definition: WorkflowDefinition;
    };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="lime"
      size="md"
      disabled={pending || disabled}
      feedback="medium"
    >
      {pending ? (
        <>
          <LoaderCircle size={16} className="animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Save size={15} strokeWidth={2.8} />
          Save new version
        </>
      )}
    </Button>
  );
}

export function WorkflowEditor({
  target,
  existingKeys,
  onClose,
  organizationId = null,
  scopeLabel = "All organizations",
  roles = [],
  modules = [],
  roleAccess = [],
}: {
  target: EditorTarget;
  /** Keys already in use in the current scope — guards create-mode collisions. */
  existingKeys: string[];
  onClose: () => void;
  /** null = platform template inherited by every org; a uuid = one org only. */
  organizationId?: string | null;
  scopeLabel?: string;
  /** Fed to the canvas so blocks speak in real modules, not abstractions. */
  roles?: { slug: string; name: string }[];
  modules?: ModuleInput[];
  roleAccess?: RoleAccess[];
}) {
  const [state, formAction] = useActionState(saveWorkflowAction, INITIAL_STATE);

  const [name, setName] = useState(target.mode === "edit" ? target.name : "");
  const [key, setKey] = useState(target.mode === "edit" ? target.key : "");
  const [module, setModule] = useState<string>(
    target.mode === "edit" ? target.module : "orders",
  );
  const [nodes, setNodes] = useState<WorkflowNode[]>(() =>
    target.mode === "edit"
      ? target.definition.nodes.map((n) => ({ ...n }))
      : emptyDefinition().nodes,
  );
  const [edges, setEdges] = useState<WorkflowEdge[]>(() =>
    target.mode === "edit"
      ? target.definition.edges.map((e) => ({ ...e }))
      : [],
  );
  const [view, setView] = useState<"form" | "json" | "canvas">("canvas");
  // Canvas edits publish straight into this, bypassing the list editor.
  const [canvasDef, setCanvasDef] = useState<WorkflowDefinition | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Portals need a DOM target, which does not exist during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextNodeId = useRef(nodes.length + 1);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (state.ok) closeRef.current();
  }, [state.ok]);

  const structured: WorkflowDefinition = useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        ...(n.label ? { label: n.label } : {}),
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        ...(e.if ? { if: e.if } : {}),
      })),
    }),
    [nodes, edges],
  );

  // The definition that will actually be submitted.
  const submittedDefinition =
    view === "json"
      ? jsonText
      : JSON.stringify(view === "canvas" && canvasDef ? canvasDef : structured);
  // The definition the Save button is actually judging. Previously this was
  // always `structured` (the LIST editor's state), so anything built on the
  // canvas never satisfied validation and Save stayed disabled forever.
  const effectiveDef = useMemo(() => {
    if (view === "json") return parseDefinition(jsonText).definition ?? structured;
    if (view === "canvas" && canvasDef) return canvasDef;
    return structured;
  }, [view, jsonText, canvasDef, structured]);

  const formError = validateDefinition(effectiveDef);
  const liveError = view === "json" ? jsonError : formError;

  const previewDef = effectiveDef;

  function switchView(next: "form" | "json" | "canvas") {
    haptic("light");
    if (next === view) return;
    if (next === "json") {
      setJsonText(
        JSON.stringify(view === "canvas" && canvasDef ? canvasDef : structured, null, 2),
      );
      setJsonError(null);
      setView("json");
      return;
    }
    if (next === "canvas") {
      // Leaving JSON for the canvas: adopt the JSON only if it parses.
      if (view === "json") {
        const parsed = parseDefinition(jsonText);
        if (parsed.error || !parsed.definition) {
          setJsonError(parsed.error ?? "Definition is invalid.");
          return;
        }
        setNodes(parsed.definition.nodes);
        setEdges(parsed.definition.edges);
        setCanvasDef(parsed.definition);
      } else {
        setCanvasDef(structured);
      }
      setJsonError(null);
      setView("canvas");
      return;
    }
    if (view === "canvas") {
      // Canvas → list: carry the canvas graph across.
      if (canvasDef) {
        setNodes(canvasDef.nodes);
        setEdges(canvasDef.edges);
      }
      setView("form");
      return;
    }
    // json → form: only adopt the JSON when it parses clean.
    const { definition, error } = parseDefinition(jsonText);
    if (error || !definition) {
      setJsonError(error ?? "Definition is invalid.");
      return;
    }
    setNodes(definition.nodes);
    setEdges(definition.edges);
    nextNodeId.current =
      definition.nodes.reduce((max, n) => {
        const m = /^n(\d+)$/.exec(n.id);
        return m ? Math.max(max, Number(m[1]) + 1) : max;
      }, definition.nodes.length + 1);
    setJsonError(null);
    setView("form");
  }

  function onJsonChange(text: string) {
    setJsonText(text);
    setJsonError(parseDefinition(text).error);
  }

  function addNode() {
    haptic("light");
    const id = `n${nextNodeId.current++}`;
    setNodes((ns) => [...ns, { id, type: "step", label: "" }]);
  }

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function removeNode(id: string) {
    haptic("medium");
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
  }

  function addEdge() {
    haptic("light");
    if (nodes.length < 2) return;
    setEdges((es) => [...es, { from: nodes[0].id, to: nodes[1].id }]);
  }

  function updateEdge(index: number, patch: Partial<WorkflowEdge>) {
    setEdges((es) => es.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeEdge(index: number) {
    haptic("medium");
    setEdges((es) => es.filter((_, i) => i !== index));
  }

  const keyTaken =
    target.mode === "create" && key.length > 0 && existingKeys.includes(key);

  if (!mounted) return null;

  // Portalled to <body> on purpose. AdminLayout wraps its children in
  // `relative z-10`, which creates a stacking context — inside it, no
  // z-index can ever paint above the admin rail (z-40), so the rail bled
  // over the full-screen canvas. A portal escapes that context entirely.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] overflow-y-auto bg-[rgb(18_21_15_/_0.45)] backdrop-blur-sm",
        view === "canvas" ? "p-0" : "p-4 sm:p-8",
      )}
    >
      <div
        className={cn(
          view === "canvas"
            // Full-screen: an OPAQUE surface. Glass here would let the fixed
            // admin rail underneath show through and clip the header text.
            ? "min-h-dvh bg-[var(--canvas)] p-4 sm:p-6"
            : "glass mx-auto max-w-3xl rounded-[var(--r-xl)] p-5 sm:p-7",
        )}
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="t-h2">
                {target.mode === "create" ? "New template" : `Edit · ${target.key}`}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                Saving always creates the next version — existing versions and
                in-flight orders are untouched. The new version starts active;
                switch it off anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              className="press glass-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-muted hover:text-ink"
            >
              <X size={16} strokeWidth={2.6} />
            </button>
          </div>

          <form action={formAction} className="mt-5 space-y-5">
            <input
              type="hidden"
              name="mode"
              value={target.mode === "create" ? "create" : "edit"}
            />
            {target.mode === "edit" && (
              <input type="hidden" name="id" value={target.id} />
            )}
            <input type="hidden" name="definition" value={submittedDefinition} />
            <input
              type="hidden"
              name="organizationId"
              value={organizationId ?? "platform"}
            />

            <p className="t-small text-muted">
              Saving to{" "}
              <span className="font-bold text-ink">{scopeLabel}</span>
              {organizationId
                ? " — this organization only."
                : " — inherited by every organization that has no override."}
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="wf-name" className={LABEL}>
                  Name
                </label>
                <input
                  id="wf-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full service dining"
                  className={FIELD}
                  required
                />
              </div>
              <div>
                <label htmlFor="wf-key" className={LABEL}>
                  Key{" "}
                  {target.mode === "edit" && (
                    <span className="normal-case">(immutable)</span>
                  )}
                </label>
                {target.mode === "edit" ? (
                  <>
                    <input type="hidden" name="key" value={key} />
                    <div className="glass-inset flex h-11 items-center rounded-[13px] px-3.5">
                      <span className="tnum text-[14px] font-bold text-muted">
                        {key}
                      </span>
                    </div>
                  </>
                ) : (
                  <input
                    id="wf-key"
                    name="key"
                    value={key}
                    onChange={(e) =>
                      setKey(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      )
                    }
                    placeholder="full_service"
                    className={cn(FIELD, "tnum")}
                    required
                  />
                )}
                {target.mode === "create" && key.length > 0 && !slugIsValid(key) && (
                  <p className="mt-1 text-[11.5px] font-semibold text-[var(--warn)]">
                    Start with a letter; lowercase letters, digits, underscores.
                  </p>
                )}
                {keyTaken && (
                  <p className="mt-1 text-[11.5px] font-semibold text-[var(--danger,var(--warn))]">
                    This key already exists — open it with Edit instead.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="wf-module" className={LABEL}>
                  Module
                </label>
                <select
                  id="wf-module"
                  name="module"
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className={FIELD}
                >
                  {(WORKFLOW_MODULES.includes(module as WorkflowModule)
                    ? WORKFLOW_MODULES
                    : [...WORKFLOW_MODULES, module]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <div className="glass-inset inline-flex rounded-[12px] p-1">
                {(
                  [
                    { v: "canvas", label: "Canvas", icon: Workflow },
                    { v: "form", label: "List", icon: ListTree },
                    { v: "json", label: "JSON", icon: Braces },
                  ] as const
                ).map(({ v, label, icon: Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => switchView(v)}
                    className={cn(
                      "press inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold",
                      view === v
                        ? "bg-[#14170f] text-white"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <Icon size={13} strokeWidth={2.6} />
                    {label}
                  </button>
                ))}
              </div>
              {view === "json" && !jsonError && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--ok)]">
                  <Check size={13} strokeWidth={3} /> Valid definition
                </span>
              )}
            </div>

            {view === "canvas" ? (
              <FlowCanvas
                initial={canvasDef ?? structured}
                roles={roles}
                modules={modules}
                roleAccess={roleAccess}
                onChange={setCanvasDef}
              />
            ) : view === "form" ? (
              <div className="space-y-5">
                {/* Nodes */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="t-label text-muted">Nodes</h3>
                    <Button type="button" variant="glass" size="sm" onClick={addNode}>
                      <Plus size={13} strokeWidth={3} />
                      Add node
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {nodes.map((node) => (
                      <li
                        key={node.id}
                        className="glass-inset flex flex-wrap items-center gap-2 rounded-[13px] p-2"
                      >
                        <span className="tnum w-10 shrink-0 text-center text-[12px] font-extrabold text-muted">
                          {node.id}
                        </span>
                        <select
                          value={node.type}
                          onChange={(e) =>
                            updateNode(node.id, { type: e.target.value })
                          }
                          className={cn(FIELD_SM, "w-32 shrink-0")}
                          aria-label={`Type for ${node.id}`}
                        >
                          {NODE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <input
                          value={node.label ?? ""}
                          onChange={(e) =>
                            updateNode(node.id, { label: e.target.value })
                          }
                          placeholder="Label"
                          className={cn(FIELD_SM, "min-w-32 flex-1")}
                          aria-label={`Label for ${node.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeNode(node.id)}
                          aria-label={`Remove ${node.id}`}
                          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:text-[var(--danger,var(--warn))]"
                        >
                          <Trash2 size={14} strokeWidth={2.4} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Edges */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="t-label text-muted">Edges</h3>
                    <Button
                      type="button"
                      variant="glass"
                      size="sm"
                      onClick={addEdge}
                      disabled={nodes.length < 2}
                    >
                      <Plus size={13} strokeWidth={3} />
                      Add edge
                    </Button>
                  </div>
                  {edges.length === 0 ? (
                    <p className="t-small text-muted">
                      No edges yet — connect the trigger to the first step.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {edges.map((edge, i) => (
                        <li
                          key={i}
                          className="glass-inset flex flex-wrap items-center gap-2 rounded-[13px] p-2"
                        >
                          <select
                            value={edge.from}
                            onChange={(e) =>
                              updateEdge(i, { from: e.target.value })
                            }
                            className={cn(FIELD_SM, "w-28 shrink-0")}
                            aria-label={`Edge ${i + 1} from`}
                          >
                            {nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.id}
                              </option>
                            ))}
                          </select>
                          <span className="text-[12px] font-bold text-muted">→</span>
                          <select
                            value={edge.to}
                            onChange={(e) => updateEdge(i, { to: e.target.value })}
                            className={cn(FIELD_SM, "w-28 shrink-0")}
                            aria-label={`Edge ${i + 1} to`}
                          >
                            {nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.id}
                              </option>
                            ))}
                          </select>
                          <input
                            value={edge.if ?? ""}
                            onChange={(e) =>
                              updateEdge(i, { if: e.target.value })
                            }
                            placeholder="if… (condition label)"
                            className={cn(FIELD_SM, "min-w-28 flex-1")}
                            aria-label={`Edge ${i + 1} condition`}
                          />
                          <button
                            type="button"
                            onClick={() => removeEdge(i)}
                            aria-label={`Remove edge ${i + 1}`}
                            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:text-[var(--danger,var(--warn))]"
                          >
                            <Trash2 size={14} strokeWidth={2.4} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <textarea
                  value={jsonText}
                  onChange={(e) => onJsonChange(e.target.value)}
                  spellCheck={false}
                  rows={14}
                  className="glass-inset tnum w-full rounded-[13px] p-3.5 text-[12.5px] leading-relaxed outline-none focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]"
                  aria-label="Workflow definition JSON"
                />
                {jsonError && (
                  <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] font-semibold text-[var(--danger,var(--warn))]">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    {jsonError}
                  </p>
                )}
              </div>
            )}

            {/* Live mini preview */}
            <div className="glass-inset rounded-[13px] p-3.5">
              <h3 className="t-label mb-2 text-muted">Preview</h3>
              <FlowPreview definition={previewDef} compact />
            </div>

            {/* A disabled Save with no explanation is the most frustrating
                thing in a builder — name the blocker. */}
            {!state.error &&
              (!name.trim() || !key.trim() || liveError || keyTaken) && (
                <p className="t-small text-muted">
                  {!name.trim()
                    ? "Give the workflow a name to save it."
                    : !key.trim()
                      ? "Give the workflow a key to save it."
                      : keyTaken
                        ? "That key is already used in this scope."
                        : liveError}
                </p>
              )}

            {(state.error || (view === "form" && formError)) && (
              <p className="inline-flex items-start gap-1.5 text-[13px] font-semibold text-[var(--danger,var(--warn))]">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                {state.error ?? formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <SubmitButton
                disabled={Boolean(liveError) || keyTaken || !name.trim() || !key.trim()}
              />
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
