import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Edit, Trash2, Package, Search, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminProducts,
  upsertProduct,
  deleteProduct,
  updateProductStockCap,
  listGameStock,
  addStockBulk,
  deleteStockItem,
} from "@/lib/admin-products.functions";

type Product = Awaited<ReturnType<typeof listAdminProducts>>[number];

export function ProductsTabV2() {
  const list = useServerFn(listAdminProducts);
  const save = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);
  const setCap = useServerFn(updateProductStockCap);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openStock, setOpenStock] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    list().then(setItems).catch(() => toast.error("Failed to load products")).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const filtered = items.filter((p) =>
    !query.trim() || p.title.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products & Account Stock</h1>
          <p className="text-sm text-muted-foreground">Add products and paste credentials in bulk — they auto-deliver on purchase.</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {creating ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add product</>}
        </button>
      </div>

      {creating && <NewProductForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} save={save} />}

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="text-xs text-muted-foreground shrink-0">{items.length} products</div>
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-5">Product</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Accounts in stock</div>
          <div className="col-span-1">Price</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No products.</div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="border-t border-border">
              <div className="grid grid-cols-12 px-4 py-3 items-center gap-2">
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center overflow-hidden text-lg shrink-0">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <span>{p.cover_emoji ?? "🛍️"}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.tagline ?? p.description ?? ""}</div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">{p.category}</div>
                <div className="col-span-2 flex items-center gap-2 text-xs">
                  <span className={p.available_stock > 0 ? "text-amber-600 font-semibold" : "text-rose-600 font-semibold"}>{p.available_stock}</span>
                  <span className="text-muted-foreground">/ cap</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={p.stock_cap}
                    onBlur={async (e) => {
                      const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                      if (v === p.stock_cap) return;
                      try { await setCap({ data: { id: p.id, stock_cap: v } }); reload(); } catch { toast.error("Failed"); }
                    }}
                    className="w-16 h-7 rounded-md border border-border bg-background px-2 text-xs"
                  />
                </div>
                <div className="col-span-1 text-sm font-semibold">${(p.price_coins / 1).toFixed(2)}</div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setOpenStock(openStock === p.id ? null : p.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${openStock === p.id ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}
                  >
                    <Package className="h-3 w-3" /> {openStock === p.id ? "Close" : "Stock"}
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">
                    <Edit className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${p.title}?`)) return;
                      try { await del({ data: { id: p.id } }); toast.success("Deleted"); reload(); } catch { toast.error("Failed"); }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
              {openStock === p.id && <StockPanel gameId={p.id} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewProductForm({ onCancel, onCreated, save }: { onCancel: () => void; onCreated: () => void; save: ReturnType<typeof useServerFn<typeof upsertProduct>> }) {
  const [form, setForm] = useState({ title: "", tagline: "", price: "2.00", stock_cap: "10", category: "Software", cover_emoji: "🛍️", image_url: "", featured: false, description: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.title.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      await save({ data: {
        title: form.title.trim(),
        tagline: form.tagline.trim() || null,
        category: form.category.trim() || "Software",
        description: form.description.trim() || null,
        price_coins: Math.max(0, Math.round(Number(form.price) || 0)),
        stock_cap: Math.max(0, Math.floor(Number(form.stock_cap) || 0)),
        cover_emoji: form.cover_emoji.trim() || null,
        image_url: form.image_url.trim() || null,
        featured: form.featured,
      } });
      toast.success("Product created");
      onCreated();
    } catch { toast.error("Failed to create"); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">New product</h2>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="h-3 w-3" /> Cancel</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="YouTube Premium" className="input" /></Field>
        <Field label="Tagline"><input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Private account, no ads, instant access" className="input" /></Field>
        <Field label="Price (USD) *"><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" /></Field>
        <Field label="Stock cap"><input type="number" value={form.stock_cap} onChange={(e) => setForm({ ...form, stock_cap: e.target.value })} className="input" /></Field>
        <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" /></Field>
        <Field label="Cover emoji"><input value={form.cover_emoji} onChange={(e) => setForm({ ...form, cover_emoji: e.target.value })} className="input" /></Field>
        <Field label="Image URL"><input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="input" /></Field>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured on home page</label>
        <Field label="Description" className="md:col-span-2"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input resize-y" /></Field>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button disabled={busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create product
        </button>
        <button onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
      </div>
      <style>{`.input { width: 100%; height: 2.25rem; border-radius: 0.625rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 0 0.75rem; font-size: 0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function StockPanel({ gameId }: { gameId: string }) {
  const listSt = useServerFn(listGameStock);
  const addSt = useServerFn(addStockBulk);
  const delSt = useServerFn(deleteStockItem);
  const [rows, setRows] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => listSt({ data: { game_id: gameId } }).then(setRows).catch(() => {});
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [gameId]);

  const submit = async () => {
    const lines = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    try {
      const r = await addSt({ data: { game_id: gameId, lines } });
      toast.success(`Added ${r.inserted}`);
      setBulk("");
      reload();
    } catch { toast.error("Failed to add"); } finally { setBusy(false); }
  };

  return (
    <div className="px-4 pb-5 pt-1 bg-muted/30 border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Add accounts (one per line)</div>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} placeholder="user1@mail.com:Pass123&#10;user2@mail.com:Pass456" className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono" />
          <button disabled={busy} onClick={submit} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add to stock
          </button>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Available accounts ({rows.length})</div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rows.length === 0 && <div className="text-xs text-muted-foreground">No accounts in stock yet.</div>}
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
                <code className="flex-1 text-[11px] font-mono truncate">{r.content}</code>
                <button onClick={async () => { await delSt({ data: { id: r.id } }); reload(); }} className="text-rose-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
