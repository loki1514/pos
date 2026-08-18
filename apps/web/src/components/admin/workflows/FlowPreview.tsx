import { ChevronRight, CirclePlay, Flag, GitFork, Box } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  byId,
  edgeLabel,
  layerNodes,
  type WorkflowDefinition,
  type WorkflowNode,
} from "./definition";

/**
 * Hand-rolled step-flow diagram: nodes layered left→right by distance from
 * the trigger, chevrons between layers. Deliberately no @xyflow/react —
 * keeps the bundle light and the build fast for a v1 read-only preview.
 */

const NODE_STYLE: Record<
  string,
  { icon: typeof Box; chip: string; dot: string }
> = {
  trigger: {
    icon: CirclePlay,
    chip: "border-[rgb(121_188_13_/_0.45)] bg-[rgb(180_238_42_/_0.14)]",
    dot: "var(--lime-deep)",
  },
  step: {
    icon: Box,
    chip: "border-[var(--line-strong)] bg-[rgb(18_21_15_/_0.03)]",
    dot: "var(--ink)",
  },
  condition: {
    icon: GitFork,
    chip: "border-[rgb(242_169_59_/_0.45)] bg-[rgb(242_169_59_/_0.12)]",
    dot: "var(--warn)",
  },
  end: {
    icon: Flag,
    chip: "border-[rgb(18_21_15_/_0.6)] bg-[#14170f] text-white",
    dot: "var(--lime-bright)",
  },
};

function NodeChip({
  def,
  node,
  compact,
}: {
  def: WorkflowDefinition;
  node: WorkflowNode;
  compact: boolean;
}) {
  const style = NODE_STYLE[node.type] ?? NODE_STYLE.step;
  const Icon = style.icon;
  const cond = edgeLabel(def, node.id);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-[11px] border font-bold",
          compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12.5px]",
          style.chip,
        )}
        title={`${node.type} · ${node.id}`}
      >
        <Icon size={compact ? 11 : 13} strokeWidth={2.6} className="shrink-0" />
        <span className="truncate">{node.label || node.id}</span>
      </span>
      {cond && (
        <span className="tnum pl-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warn)]">
          if {cond}
        </span>
      )}
    </div>
  );
}

export function FlowPreview({
  definition,
  compact = false,
}: {
  definition: WorkflowDefinition;
  compact?: boolean;
}) {
  if (!definition?.nodes?.length) {
    return <p className="t-small text-muted">Empty definition.</p>;
  }
  const layers = layerNodes(definition);

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className={cn(
          "flex items-center",
          compact ? "gap-1.5" : "gap-2.5",
        )}
      >
        {layers.map((layer, i) => (
          <div key={i} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                size={compact ? 13 : 15}
                strokeWidth={3}
                className="shrink-0 text-muted"
              />
            )}
            <div className="flex flex-col gap-1.5">
              {layer.map((node) => (
                <NodeChip
                  key={node.id}
                  def={definition}
                  node={node}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ordered edge list, shown under the preview when space allows. */
export function EdgeList({ definition }: { definition: WorkflowDefinition }) {
  const nodes = byId(definition);
  if (!definition.edges.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {definition.edges.map((e, i) => (
        <li
          key={i}
          className="tnum inline-flex items-center gap-1 text-[11px] font-semibold text-muted"
        >
          <span>{nodes.get(e.from)?.label || e.from}</span>
          <ChevronRight size={10} strokeWidth={3} />
          <span>{nodes.get(e.to)?.label || e.to}</span>
          {e.if && (
            <span className="font-bold text-[var(--warn)]">if {e.if}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
