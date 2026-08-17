/**
 * Placeholder data for the Master Admin screens.
 *
 * TEMPORARY: replaced by Supabase queries once the `organizations` migration
 * lands (build order Phase 1). Shapes here intentionally mirror the planned
 * table columns so the swap is a data-source change, not a UI rewrite.
 */

export type OrgType = "Franchise" | "Investor";
export type OrgStatus = "active" | "onboarding" | "suspended";

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  status: OrgStatus;
  locations: number;
  users: number;
  ordersToday: number;
  createdAt: string;
};

export const ORGANIZATIONS: Organization[] = [
  {
    id: "org_01",
    name: "Spice Route Hospitality",
    type: "Franchise",
    status: "active",
    locations: 12,
    users: 148,
    ordersToday: 1842,
    createdAt: "2026-02-14",
  },
  {
    id: "org_02",
    name: "Curry Leaf Group",
    type: "Investor",
    status: "active",
    locations: 5,
    users: 62,
    ordersToday: 730,
    createdAt: "2026-03-02",
  },
  {
    id: "org_03",
    name: "Tandoor Junction",
    type: "Franchise",
    status: "active",
    locations: 8,
    users: 94,
    ordersToday: 1120,
    createdAt: "2026-04-21",
  },
  {
    id: "org_04",
    name: "Coastal Kitchens Pvt Ltd",
    type: "Investor",
    status: "onboarding",
    locations: 2,
    users: 14,
    ordersToday: 0,
    createdAt: "2026-08-09",
  },
  {
    id: "org_05",
    name: "Urban Tadka Restaurants",
    type: "Franchise",
    status: "active",
    locations: 21,
    users: 265,
    ordersToday: 3096,
    createdAt: "2026-01-08",
  },
  {
    id: "org_06",
    name: "Nilgiri Cafe Co.",
    type: "Investor",
    status: "suspended",
    locations: 3,
    users: 28,
    ordersToday: 0,
    createdAt: "2026-05-30",
  },
];

export type ActivityItem = {
  id: string;
  org: string;
  event: string;
  at: string;
  tone: "neutral" | "good" | "warn";
};

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", org: "Urban Tadka", event: "Location “Indiranagar” went live", at: "6m", tone: "good" },
  { id: "a2", org: "Coastal Kitchens", event: "Organization admin invited", at: "24m", tone: "neutral" },
  { id: "a3", org: "Spice Route", event: "KOT workflow updated to Counter", at: "1h", tone: "neutral" },
  { id: "a4", org: "Nilgiri Cafe", event: "Billing suspended — payment failed", at: "3h", tone: "warn" },
  { id: "a5", org: "Tandoor Junction", event: "14 users provisioned", at: "5h", tone: "neutral" },
];

/** 14-day platform order volume, newest last. */
export const VOLUME: number[] = [
  42, 51, 47, 63, 58, 72, 88, 76, 81, 95, 89, 104, 98, 118,
];
