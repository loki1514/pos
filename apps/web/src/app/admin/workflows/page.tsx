import type { Metadata } from "next";
import { listWorkflowTemplates } from "@/lib/tenant";
import { WorkflowsManager } from "@/components/admin/workflows/WorkflowsManager";

export const metadata: Metadata = { title: "Workflows" };
export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const templates = await listWorkflowTemplates();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-h1">Workflows</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Workflows are versioned JSON. In-flight orders keep the version they
          started with — editing creates a new version, which starts active.
        </p>
      </div>

      <WorkflowsManager templates={templates} />
    </div>
  );
}
