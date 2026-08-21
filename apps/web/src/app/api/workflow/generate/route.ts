import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listModules } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Plain English → a workflow definition the canvas can render.
 *
 * The model is never trusted to invent structure. It is handed the exact
 * module keys and role slugs that exist in this deployment, told to use only
 * those, and everything it returns is re-validated here against the live
 * registry — an unknown module key is dropped, not rendered. The worst a bad
 * generation can do is produce a small or empty flow, never an invalid one.
 */

const MODEL = "openai/gpt-oss-120b";

type GenNode = {
  id: string;
  kind: string;
  label: string;
  config?: Record<string, unknown>;
};
type GenEdge = { from: string; to: string; if?: string };

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set on this deployment." },
      { status: 500 },
    );
  }

  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = (body.prompt ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Describe the flow first." }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "That description is too long." }, { status: 400 });
  }

  // Ground the model in what this deployment actually has.
  const [modules, rolesRes] = await Promise.all([
    listModules(),
    supabaseAdmin.from("roles").select("slug, name").order("created_at"),
  ]);
  const roles = rolesRes.data ?? [];

  const moduleList = modules
    .map((m) => `  module:${m.key} — ${m.name}`)
    .join("\n");
  const roleList = roles.map((r) => `  ${r.slug} — ${r.name}`).join("\n");

  const system = `You turn a restaurant operator's plain description into a workflow graph for Vini POS.

Reply with ONLY a JSON object, no prose, no markdown fences:
{"nodes":[{"id":"n1","kind":"signin","label":"Captain signs in","config":{"role":"captain"}}],"edges":[{"from":"n1","to":"n2"}]}

Allowed "kind" values — nothing else:
  signin      the entry point. config: {"role": "<role slug>"}
  module:<key>  a screen the staff member uses. config: {"roles": ["<role slug>"]}
  rule        a branch. config: {"expression": "amount > 500"}. Give it TWO outgoing edges labelled with "if":"true" and "if":"false"
  approval    someone must approve. config: {"role": "<role slug>"}
  automation  happens automatically. config: {"action": "notify"|"auto_approve"|"escalate"|"print_kot"}
  end         the flow finishes

Modules that exist (use these keys exactly):
${moduleList}

Roles that exist (use these slugs exactly):
${roleList}

Rules:
- Every flow starts with exactly one signin node and ends with at least one end node.
- Every node except signin must be reachable by an edge.
- Node ids are short and unique: n1, n2, n3…
- Never invent a module key or role slug that is not listed above.
- Keep it to at most 12 nodes.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("groq:", res.status, detail.slice(0, 400));

      // A 400 with json_validate_failed usually means the model answered in
      // prose instead of JSON — most often because it is *correctly* refusing
      // to invent a module or role that doesn't exist. Its own sentence is
      // far more useful to the operator than the status code.
      try {
        const parsedErr = JSON.parse(detail) as {
          error?: { code?: string; failed_generation?: string };
        };
        const refusal = parsedErr.error?.failed_generation?.trim();
        if (parsedErr.error?.code === "json_validate_failed" && refusal) {
          return NextResponse.json(
            { error: refusal.slice(0, 300) },
            { status: 422 },
          );
        }
      } catch {
        /* fall through to the generic message */
      }

      return NextResponse.json(
        { error: `The generator returned ${res.status}. Try again.` },
        { status: 502 },
      );
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";

    let parsed: { nodes?: GenNode[]; edges?: GenEdge[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "The generator didn't return usable JSON. Try rephrasing." },
        { status: 502 },
      );
    }

    // ---- Validate against the live registry -------------------------------
    const validModule = new Set(modules.map((m) => `module:${m.key}`));
    const validRole = new Set(roles.map((r) => r.slug));
    const FLOW = new Set(["signin", "rule", "approval", "automation", "end"]);
    const subsByKey = new Map(
      modules.map((m) => [
        `module:${m.key}`,
        ((m.submodules ?? []) as { key: string }[]).map((s) => s.key),
      ]),
    );

    const kept: GenNode[] = [];
    for (const n of parsed.nodes ?? []) {
      if (!n?.id || typeof n.kind !== "string") continue;
      if (!FLOW.has(n.kind) && !validModule.has(n.kind)) continue;

      const config: Record<string, unknown> = { ...(n.config ?? {}) };

      // Drop role references the deployment doesn't have.
      if (typeof config.role === "string" && !validRole.has(config.role)) {
        delete config.role;
      }
      if (Array.isArray(config.roles)) {
        config.roles = (config.roles as string[]).filter((r) => validRole.has(r));
      }
      // Module blocks arrive with all their screens on, matching drag-drop.
      if (validModule.has(n.kind) && !config.submodules) {
        config.submodules = subsByKey.get(n.kind) ?? [];
      }

      kept.push({ id: String(n.id), kind: n.kind, label: String(n.label ?? ""), config });
    }

    const ids = new Set(kept.map((n) => n.id));
    const edges = (parsed.edges ?? []).filter(
      (e) => e?.from && e?.to && ids.has(e.from) && ids.has(e.to),
    );

    if (kept.length === 0) {
      return NextResponse.json(
        { error: "Nothing usable came back — try naming the modules explicitly." },
        { status: 422 },
      );
    }

    // Lay out left-to-right by depth from the entry node so the result is
    // readable the moment it lands, rather than a pile at the origin.
    const depth = new Map<string, number>();
    const entry = kept.find((n) => n.kind === "signin") ?? kept[0];
    const queue: [string, number][] = [[entry.id, 0]];
    depth.set(entry.id, 0);
    while (queue.length) {
      const [id, d] = queue.shift()!;
      for (const e of edges.filter((x) => x.from === id)) {
        if (!depth.has(e.to)) {
          depth.set(e.to, d + 1);
          queue.push([e.to, d + 1]);
        }
      }
    }
    const perCol = new Map<number, number>();

    const nodes = kept.map((n) => {
      const d = depth.get(n.id) ?? 0;
      const row = perCol.get(d) ?? 0;
      perCol.set(d, row + 1);
      return {
        id: n.id,
        // The canvas resolves the real type from data.kind.
        type: n.kind === "signin" ? "trigger" : n.kind === "end" ? "end" : "state",
        label: n.label,
        data: {
          kind: n.kind,
          config: n.config ?? {},
          position: { x: 40 + d * 250, y: 80 + row * 170 },
        },
      };
    });

    return NextResponse.json({
      definition: { nodes, edges: edges.map(({ from, to, if: c }) => ({ from, to, ...(c ? { if: c } : {}) })) },
      dropped: (parsed.nodes ?? []).length - kept.length,
    });
  } catch (err) {
    console.error("workflow/generate:", err);
    return NextResponse.json(
      { error: "Could not reach the generator. Try again." },
      { status: 502 },
    );
  }
}
