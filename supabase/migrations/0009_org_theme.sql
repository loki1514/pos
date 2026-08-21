-- ============================================================================
-- 0009 — Per-organization appearance ("Chameleon")
--
-- The reference PRD themes per *user*. Vini POS is white-label multi-tenant,
-- so appearance belongs to the ORGANIZATION: every member of Krave sees
-- Krave's brand, whatever device they sign in from. That also matches the
-- master-admin flow — "configures the UI, logo and key details for org".
--
-- Stored as one jsonb column rather than five scalar columns because the
-- shape will keep growing (logo, dark-mode pass, time-of-day drift) and every
-- read is "give me the whole theme" anyway.
-- ============================================================================

alter table public.organizations
  add column if not exists theme jsonb not null default '{}'::jsonb;

comment on column public.organizations.theme is
  'Appearance for this org: {accent, font, weatherHint, backgroundUrl, backgroundOpacity}. Empty object = platform default (lime).';

-- Shape guard. Kept permissive on purpose — unknown keys are ignored by the
-- reader, so a newer client writing extra fields never breaks an older one.
alter table public.organizations
  drop constraint if exists organizations_theme_shape;

alter table public.organizations
  add constraint organizations_theme_shape check (
    jsonb_typeof(theme) = 'object'
    and (
      not (theme ? 'accent')
      or theme ->> 'accent' ~ '^#[0-9a-fA-F]{6}$'
    )
    and (
      not (theme ? 'backgroundOpacity')
      or (
        jsonb_typeof(theme -> 'backgroundOpacity') = 'number'
        and (theme ->> 'backgroundOpacity')::numeric between 0 and 1
      )
    )
  );

-- Members already read their own organization row (0004
-- organizations_member_select), so the theme comes along with it — no new
-- policy needed. Writes stay with platform admins and org admins via the
-- existing organizations_admin_update policy.
