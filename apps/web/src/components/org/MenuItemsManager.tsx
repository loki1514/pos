"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { MenuCategory, MenuItem } from "@/lib/pos";
import {
  deleteMenuItemAction,
  saveMenuItemAction,
  setAvailabilityAction,
} from "@/app/org/menu-items/actions";

const FIELD =
  "glass-inset h-11 w-full rounded-[13px] px-3.5 text-[14.5px] font-medium " +
  "outline-none transition-shadow placeholder:text-muted/70 " +
  "focus:shadow-[inset_0_0_0_2px_var(--lime-deep)]";

const LABEL = "t-label mb-1.5 block text-muted";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function validateImage(file: File): string | null {
  if (!IMAGE_TYPES[file.type]) return "Only JPG, PNG or WebP images are allowed.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 2 MB or smaller.";
  return null;
}

async function uploadImage(
  organizationId: string,
  itemId: string,
  file: File,
): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  const path = `${organizationId}/${itemId}.${ext}`;
  const supabase = supabaseBrowser();
  const { error } = await supabase.storage
    .from("item-images")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const {
    data: { publicUrl },
  } = supabase.storage.from("item-images").getPublicUrl(path);
  // Cache-bust so a replaced image shows immediately everywhere.
  return `${publicUrl}?v=${Date.now()}`;
}

function formatINR(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ---------------------------------------------------------------------- */
/* Availability toggle — the big, obvious "Item On/Off" the POS uses       */
/* ---------------------------------------------------------------------- */

function AvailabilityToggle({
  on,
  disabled,
  onChange,
  size = "md",
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  size?: "md" | "lg";
}) {
  const dims =
    size === "lg" ? "h-12 w-[88px]" : "h-11 w-[80px]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Item is on — tap to switch off" : "Item is off — tap to switch on"}
      disabled={disabled}
      onPointerDown={() => haptic("medium")}
      onClick={() => onChange(!on)}
      className={cn(
        "press relative inline-flex shrink-0 items-center rounded-full px-1.5 transition-colors",
        dims,
        on ? "bg-[var(--ok)]" : "bg-[rgb(18_21_15_/_0.14)] dark:bg-[rgb(255_255_255_/_0.14)]",
        disabled && "opacity-45 pointer-events-none",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute text-[10.5px] font-extrabold uppercase tracking-wider transition-opacity",
          on ? "left-3 text-white" : "right-3 text-muted",
        )}
      >
        {on ? "On" : "Off"}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative z-10 rounded-full bg-white shadow-[0_2px_6px_rgb(18_21_15_/_0.3)] transition-transform",
          size === "lg" ? "h-9 w-9" : "h-8 w-8",
          on
            ? size === "lg"
              ? "translate-x-[42px]"
              : "translate-x-[38px]"
            : "translate-x-0",
        )}
      />
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Add / Edit dialog                                                       */
/* ---------------------------------------------------------------------- */

type Draft = {
  id?: string;
  name: string;
  sku: string;
  categoryId: string | null;
  newCategoryName: string;
  price: string;
  sortOrder: string;
  isAvailable: boolean;
  imageUrl: string | null;
  /** Local file picked but not yet uploaded. */
  file: File | null;
  /** True when the staff explicitly removed the current image. */
  removeImage: boolean;
};

function draftFrom(item: MenuItem | null, sortHint: number): Draft {
  return {
    id: item?.id,
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    categoryId: item?.category_id ?? null,
    newCategoryName: "",
    price: item != null ? String(item.price) : "",
    sortOrder: String(item?.sort_order ?? sortHint),
    isAvailable: item?.is_available ?? true,
    imageUrl: item?.image_url ?? null,
    file: null,
    removeImage: false,
  };
}

function ItemDialog({
  organizationId,
  categories,
  item,
  sortHint,
  onClose,
}: {
  organizationId: string;
  categories: MenuCategory[];
  item: MenuItem | null;
  sortHint: number;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, sortHint));
  const [categoryMode, setCategoryMode] = useState<"pick" | "new">("pick");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);

  const shownImage = draft.removeImage ? null : (previewUrl ?? draft.imageUrl);

  function pickFile(file: File | null) {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setError(problem);
      haptic("warn");
      return;
    }
    setError(null);
    setDraft((d) => ({ ...d, file, removeImage: false }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        let imageUrl: string | null | undefined;
        if (draft.file) {
          imageUrl = await uploadImage(
            organizationId,
            draft.id ?? crypto.randomUUID(),
            draft.file,
          );
        } else if (draft.removeImage) {
          imageUrl = null;
        }

        const result = await saveMenuItemAction({
          organizationId,
          id: draft.id,
          name: draft.name,
          sku: draft.sku || null,
          categoryId: categoryMode === "new" ? null : draft.categoryId,
          newCategoryName:
            categoryMode === "new" ? draft.newCategoryName : null,
          price: Number(draft.price),
          sortOrder: Number(draft.sortOrder),
          isAvailable: draft.isAvailable,
          imageUrl,
        });

        if (!result.ok) {
          setError(result.error);
          haptic("warn");
          return;
        }
        haptic("success");
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        haptic("warn");
      }
    });
  }

  function hardDelete() {
    if (!draft.id) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMenuItemAction(organizationId, draft.id!);
      if (!result.ok) {
        setError(result.error);
        haptic("warn");
        return;
      }
      haptic("success");
      onClose();
    });
  }

  const priceValid = draft.price !== "" && Number.isFinite(Number(draft.price)) && Number(draft.price) >= 0;
  const nameValid = draft.name.trim().length > 0;
  const categoryValid =
    categoryMode === "pick"
      ? true
      : draft.newCategoryName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="glass rise relative z-10 flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-[var(--r-2xl)] sm:rounded-[var(--r-2xl)]">
        <div className="relative z-10 flex items-start justify-between gap-4 p-6 pb-0 sm:p-7 sm:pb-0">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: "#14170f" }}
            >
              <UtensilsCrossed size={17} className="text-[var(--lime)]" />
            </span>
            <div>
              <h2 className="t-h3">{item ? "Edit item" : "Add item"}</h2>
              <p className="t-small text-muted">
                {item ? item.name : "It shows up on the POS grid immediately."}
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="press inline-flex h-9 w-9 items-center justify-center rounded-[11px] text-muted hover:bg-[rgb(18_21_15_/_0.06)] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scroll-thin relative z-10 flex-1 space-y-4 overflow-y-auto p-6 sm:p-7">
          {/* Image */}
          <div>
            <span className={LABEL}>Photo</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="press glass-inset relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[16px] text-muted"
                aria-label="Pick item photo"
              >
                {shownImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shownImage}
                    alt={draft.name || "Item photo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus size={22} />
                )}
              </button>
              <div className="space-y-2">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={14} />
                  {shownImage ? "Replace photo" : "Upload photo"}
                </Button>
                {shownImage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        file: null,
                        removeImage: true,
                      }))
                    }
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                )}
                <p className="t-small text-muted">JPG, PNG or WebP · max 2 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="mi-name" className={LABEL}>
                Item name
              </label>
              <input
                id="mi-name"
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Masala Dosa"
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="mi-sku" className={LABEL}>
                SKU <span className="normal-case opacity-70">(optional)</span>
              </label>
              <input
                id="mi-sku"
                value={draft.sku}
                onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                placeholder="BF-001"
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="mi-price" className={LABEL}>
                Price (₹)
              </label>
              <input
                id="mi-price"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                required
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="120.00"
                className={cn(FIELD, "tnum")}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <span className={LABEL}>Category</span>
            <div className="mb-2 grid grid-cols-2 gap-2.5">
              {(["pick", "new"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onPointerDown={() => haptic("light")}
                  onClick={() => setCategoryMode(mode)}
                  className={cn(
                    "press rounded-[12px] px-3 py-2.5 text-[13.5px] font-bold transition-colors",
                    categoryMode === mode
                      ? "btn-lime"
                      : "glass-inset text-ink-2 hover:text-ink",
                  )}
                >
                  <span className="relative z-10">
                    {mode === "pick" ? "Existing" : "+ New category"}
                  </span>
                </button>
              ))}
            </div>
            {categoryMode === "pick" ? (
              <select
                aria-label="Category"
                value={draft.categoryId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    categoryId: e.target.value || null,
                  }))
                }
                className={FIELD}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label="New category name"
                value={draft.newCategoryName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, newCategoryName: e.target.value }))
                }
                placeholder="e.g. Hot Beverages"
                className={FIELD}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mi-sort" className={LABEL}>
                Sort order
              </label>
              <input
                id="mi-sort"
                inputMode="numeric"
                type="number"
                step="1"
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sortOrder: e.target.value }))
                }
                className={cn(FIELD, "tnum")}
              />
              <p className="mt-1.5 t-small text-muted">
                Lower shows first on the POS grid.
              </p>
            </div>
            <div>
              <span className={LABEL}>Item on / off</span>
              <div className="flex h-11 items-center gap-3">
                <AvailabilityToggle
                  size="lg"
                  on={draft.isAvailable}
                  onChange={(v) => setDraft((d) => ({ ...d, isAvailable: v }))}
                />
                <span className="t-small text-muted">
                  {draft.isAvailable
                    ? "Visible on the POS"
                    : "Hidden from billing"}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div
              className="flex items-start gap-2.5 rounded-[13px] px-3.5 py-3 text-[13px] font-medium"
              style={{
                background: "rgb(226 86 75 / 0.1)",
                color: "var(--danger)",
                border: "1px solid rgb(226 86 75 / 0.26)",
              }}
            >
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 border-t border-[var(--line)] p-5 sm:px-7">
          {item && !confirmDelete && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(true)}
              className="text-[var(--danger)]"
            >
              <Trash2 size={15} />
              Delete
            </Button>
          )}
          {item && confirmDelete && (
            <span className="flex items-center gap-2">
              <span className="t-small font-bold text-[var(--danger)]">
                Delete permanently? Prefer switching the item off.
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={hardDelete}
                className="text-[var(--danger)]"
              >
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </span>
          )}
          <span className="flex-1" />
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="lime"
            size="md"
            feedback="medium"
            disabled={pending || !nameValid || !priceValid || !categoryValid}
            onClick={save}
          >
            {pending ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>{item ? "Save changes" : "Add item"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Manager — filter bar + item list                                        */
/* ---------------------------------------------------------------------- */

export function MenuItemsManager({
  organizationId,
  categories,
  items,
}: {
  organizationId: string;
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const [filter, setFilter] = useState<string | "all" | "none">("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item: MenuItem | null }>({
    open: false,
    item: null,
  });
  const [, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (filter === "none" && item.category_id !== null) return false;
    if (filter !== "all" && filter !== "none" && item.category_id !== filter)
      return false;
    if (q && !item.name.toLowerCase().includes(q) && !(item.sku ?? "").toLowerCase().includes(q))
      return false;
    return true;
  });

  const offCount = items.filter((i) => !i.is_available).length;
  const nextSort = (items.at(-1)?.sort_order ?? 0) + 1;

  function toggle(item: MenuItem, next: boolean) {
    setTogglingId(item.id);
    startTransition(async () => {
      const result = await setAvailabilityAction(organizationId, item.id, next);
      if (!result.ok) haptic("warn");
      setTogglingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="glass-inset flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-[13px] px-3.5 sm:max-w-[280px]">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            aria-label="Search menu items"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:text-muted/70"
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {[{ id: "all" as const, name: "All" }, ...categories, ...(items.some((i) => i.category_id === null) ? [{ id: "none" as const, name: "Uncategorized" }] : [])].map((c) => (
            <button
              key={c.id}
              onPointerDown={() => haptic("light")}
              onClick={() => setFilter(c.id)}
              className={cn(
                "press h-9 rounded-full px-3.5 text-[13px] font-bold transition-colors",
                filter === c.id
                  ? "btn-lime"
                  : "glass-inset text-ink-2 hover:text-ink",
              )}
            >
              <span className="relative z-10">{c.name}</span>
            </button>
          ))}
        </div>
        <Button
          variant="lime"
          size="md"
          feedback="medium"
          onClick={() => setDialog({ open: true, item: null })}
          className="ml-auto"
        >
          <Plus size={15} strokeWidth={3} />
          Add item
        </Button>
      </div>

      {/* List */}
      <div className="glass-solid rounded-[var(--r-xl)] p-4 sm:p-5">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 px-1 pb-3">
            <UtensilsCrossed size={16} className="text-[var(--lime-deep)]" />
            <h2 className="t-h3">Items</h2>
            <span className="t-small ml-auto text-muted">
              {visible.length} of {items.length}
              {offCount > 0 && ` · ${offCount} off`}
            </span>
          </div>

          <ul className="divide-y divide-[var(--line)]">
            {visible.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 py-3 sm:gap-4",
                  !item.is_available && "opacity-70",
                )}
              >
                <span className="glass-inset flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] text-muted">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <UtensilsCrossed size={18} />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-bold leading-tight">
                    {item.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {item.sku && <span className="tnum">{item.sku} · </span>}
                    {categoryName(item.category_id)}
                  </span>
                </span>

                <span className="tnum ml-auto hidden shrink-0 text-[14px] font-bold sm:block">
                  {formatINR(item.price)}
                </span>

                <span className="flex shrink-0 items-center gap-2 sm:ml-2">
                  <AvailabilityToggle
                    on={item.is_available}
                    disabled={togglingId === item.id}
                    onChange={(next) => toggle(item, next)}
                  />
                  <button
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setDialog({ open: true, item })}
                    className="press inline-flex h-11 w-11 items-center justify-center rounded-[13px] text-muted hover:bg-[rgb(18_21_15_/_0.05)] hover:text-ink"
                  >
                    <Pencil size={16} />
                  </button>
                </span>
              </li>
            ))}

            {visible.length === 0 && (
              <li className="py-12 text-center">
                <UtensilsCrossed size={22} className="mx-auto mb-3 text-muted" />
                <p className="text-[14.5px] font-bold">No items here yet</p>
                <p className="t-small mt-1 text-muted">
                  {q || filter !== "all"
                    ? "Try a different search or category."
                    : "Add your first item — it appears on the POS right away."}
                </p>
              </li>
            )}
          </ul>
        </div>
      </div>

      {dialog.open && (
        <ItemDialog
          organizationId={organizationId}
          categories={categories}
          item={dialog.item}
          sortHint={nextSort}
          onClose={() => setDialog({ open: false, item: null })}
        />
      )}
    </div>
  );
}
