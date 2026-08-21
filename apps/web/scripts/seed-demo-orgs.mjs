/**
 * Seed two contrasting demo organizations so module toggling is visible.
 *
 *   node scripts/seed-demo-orgs.mjs            # create
 *   node scripts/seed-demo-orgs.mjs --remove   # delete everything it created
 *
 * The two orgs exist to make the control plane observable:
 *
 *   Saffron House      full-service franchise — every module on
 *   Chai Point Express counter/QR kiosk       — inventory, finance, CRM off
 *
 * Sign in as either org admin and the sidebars differ, because the sidebar
 * reads org_modules (lib/org-modules.ts). That difference IS the test.
 *
 * Idempotent: re-running updates rather than duplicating. Everything is
 * tagged with settings.demo_seed = true so --remove can find it precisely and
 * never touch a real organization.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("WebSocket is not available in the seed script.");
    }
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REMOVE = process.argv.includes("--remove");
const fail = (step, error) => {
  console.error(`✗ ${step}: ${error.message ?? error}`);
  process.exit(1);
};

/** Every demo org carries this marker so teardown can never hit real data. */
const MARKER = { demo_seed: true };

const DEMO = [
  {
    slug: "saffron-house",
    name: "Saffron House",
    type: "franchise",
    status: "active",
    legal_name: "Saffron House Hospitality Pvt Ltd",
    contact_email: "ops@saffronhouse.example",
    contact_phone: "+91 98800 11223",
    admin: { email: "admin@saffronhouse.example", password: "SaffronDemo2026!a" },
    // Full-service: everything on.
    disabled: [],
    domains: [{ domain: "saffron-house.vinipos.com", kind: "subdomain", primary: true }],
  },
  {
    slug: "chai-point-express",
    name: "Chai Point Express",
    type: "investor",
    status: "active",
    legal_name: "Chai Point Express LLP",
    contact_email: "owner@chaipoint.example",
    contact_phone: "+91 91234 55667",
    admin: { email: "admin@chaipoint.example", password: "ChaiDemo2026!b" },
    // Counter/QR kiosk: no stock control, no books, no loyalty programme.
    disabled: ["inventory", "finance", "marketing_crm"],
    domains: [{ domain: "chai-point-express.vinipos.com", kind: "subdomain", primary: true }],
  },
];

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

if (REMOVE) {
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, settings")
    .in("slug", DEMO.map((d) => d.slug));
  if (error) fail("find demo orgs", error);

  const demoOrgs = (orgs ?? []).filter((o) => o.settings?.demo_seed === true);
  const skipped = (orgs ?? []).length - demoOrgs.length;
  if (skipped > 0) {
    console.log(`↷ skipped ${skipped} org(s) with a matching slug but no demo marker`);
  }

  for (const org of demoOrgs) {
    // Delete the auth users first — org_users rows cascade from either side,
    // but the auth user is not owned by the org and would otherwise linger.
    const { data: members } = await supabase
      .from("org_users")
      .select("user_id")
      .eq("organization_id", org.id);

    for (const m of members ?? []) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(m.user_id);
      if (delErr && !/not found/i.test(delErr.message)) {
        console.warn(`  ! auth user ${m.user_id}: ${delErr.message}`);
      }
    }

    // org_domains / org_modules / org_users all cascade on organization delete.
    const { error: orgErr } = await supabase
      .from("organizations")
      .delete()
      .eq("id", org.id);
    if (orgErr) fail(`delete ${org.name}`, orgErr);

    console.log(`✓ removed ${org.name}`);
  }

  console.log(demoOrgs.length ? "\nDemo data removed." : "\nNothing to remove.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

// The module registry must exist (migration 0007).
const { data: modules, error: modErr } = await supabase
  .from("modules")
  .select("key, name, is_core");
if (modErr) {
  fail(
    "read module registry",
    new Error(`${modErr.message} — has migration 0007_control_plane.sql been applied?`),
  );
}

const { data: adminRole, error: roleErr } = await supabase
  .from("roles")
  .select("id")
  .eq("slug", "org_admin")
  .single();
if (roleErr) fail("find org_admin role", roleErr);

for (const spec of DEMO) {
  // --- organization (upsert by slug) ---
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .upsert(
      {
        slug: spec.slug,
        name: spec.name,
        type: spec.type,
        status: spec.status,
        legal_name: spec.legal_name,
        contact_email: spec.contact_email,
        contact_phone: spec.contact_phone,
        settings: MARKER,
      },
      { onConflict: "slug" },
    )
    .select("id, name")
    .single();
  if (orgErr) fail(`upsert ${spec.name}`, orgErr);

  console.log(`\n${org.name}`);

  // --- admin auth user ---
  let userId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: spec.admin.email,
    password: spec.admin.password,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`  ✓ auth user ${spec.admin.email}`);
  } else if (/already been registered|already exists/i.test(createErr?.message ?? "")) {
    // Re-run: find the existing user and reset the password so the documented
    // demo credentials always work.
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === spec.admin.email.toLowerCase(),
    );
    if (!existing) fail("locate existing admin", new Error(spec.admin.email));
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, { password: spec.admin.password });
    console.log(`  ↻ auth user ${spec.admin.email} (password reset)`);
  } else {
    fail(`create admin for ${spec.name}`, createErr);
  }

  // --- membership ---
  const { error: memberErr } = await supabase.from("org_users").upsert(
    {
      organization_id: org.id,
      user_id: userId,
      role_id: adminRole.id,
      email: spec.admin.email,
      full_name: `${spec.name} Admin`,
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );
  if (memberErr) fail(`link admin to ${spec.name}`, memberErr);

  // --- module toggles: a row per module, so the org detail card shows the
  //     full catalog rather than inferring defaults ---
  const rows = modules.map((m) => ({
    organization_id: org.id,
    module_key: m.key,
    // Core modules can never be off; optional ones follow the spec.
    enabled: m.is_core ? true : !spec.disabled.includes(m.key),
  }));

  const { error: toggleErr } = await supabase
    .from("org_modules")
    .upsert(rows, { onConflict: "organization_id,module_key" });
  if (toggleErr) fail(`set modules for ${spec.name}`, toggleErr);

  const off = rows.filter((r) => !r.enabled).map((r) => r.module_key);
  console.log(`  ✓ modules — ${rows.length - off.length} on${off.length ? `, off: ${off.join(", ")}` : ""}`);

  // --- domains ---
  for (const d of spec.domains) {
    const { error: domErr } = await supabase.from("org_domains").upsert(
      {
        organization_id: org.id,
        domain: d.domain,
        kind: d.kind,
        is_primary: d.primary ?? false,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "domain" },
    );
    if (domErr) fail(`add domain ${d.domain}`, domErr);
    console.log(`  ✓ domain ${d.domain}`);
  }
}

console.log(`
Done. Sign in at /login:

  Saffron House       admin@saffronhouse.example  /  SaffronDemo2026!a
  Chai Point Express  admin@chaipoint.example     /  ChaiDemo2026!b

Saffron sees the full sidebar. Chai Point has no Inventory, Customers &
CRM, Payments or Reports — those modules are switched off for that org.

Remove it all:  node scripts/seed-demo-orgs.mjs --remove
`);
