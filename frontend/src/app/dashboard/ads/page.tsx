"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
  ImageIcon,
  DollarSign,
  Tag,
} from "lucide-react";
import { adsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Ad, AdStatus, AdUpdate } from "@/types";

const statusConfig: Record<AdStatus, { variant: "success" | "warning" | "secondary" | "destructive"; label: string }> = {
  active: { variant: "success", label: "Active" },
  paused: { variant: "warning", label: "Paused" },
  draft: { variant: "secondary", label: "Draft" },
  archived: { variant: "destructive", label: "Archived" },
};

export default function AdsPage() {
  const { token } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [editForm, setEditForm] = useState<AdUpdate>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete dialog
  const [deleteAd, setDeleteAd] = useState<Ad | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadAds = useCallback(async () => {
    if (!token) return;
    try {
      const list = await adsApi.list(token);
      setAds(list);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Open edit dialog
  function openEdit(ad: Ad) {
    setEditAd(ad);
    setEditForm({
      title: ad.title,
      description: ad.description,
      product_url: ad.product_url,
      image_url: ad.image_url || undefined,
      category: ad.category,
      keywords: ad.keywords,
      bid_amount: ad.bid_amount,
      status: ad.status,
    });
    setEditError("");
  }

  // Submit edit
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editAd) return;
    setEditLoading(true);
    setEditError("");
    try {
      await adsApi.update(token, editAd.id, editForm);
      setEditAd(null);
      loadAds();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditLoading(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!token || !deleteAd) return;
    setDeleteLoading(true);
    try {
      await adsApi.delete(token, deleteAd.id);
      setDeleteAd(null);
      loadAds();
    } catch {
      // silently fail
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredAds = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(search.toLowerCase()) ||
      ad.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ads Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage your ad creatives</p>
        </div>
        <Link href="/dashboard/ads/new">
          <Button className="rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity shadow-md shadow-primary/20 gap-2">
            <Plus className="h-4 w-4" />
            New Ad
          </Button>
        </Link>
      </div>

      {/* Search */}
      {ads.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search ads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-10 border-0 bg-card"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : ads.length === 0 ? (
        <Card className="border-0 bg-card border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No ads yet</h3>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              Create your first ad and the AI engine will semantically match it to relevant user prompts.
            </p>
            <Link href="/dashboard/ads/new">
              <Button className="rounded-xl gradient-primary text-white hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Create Ad
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredAds.map((ad) => (
            <Card key={ad.id} className="group border-0 bg-card hover:bg-card/80 transition-all duration-200 overflow-hidden">
              {/* Image */}
              {ad.image_url && (
                <div className="w-full h-40 overflow-hidden bg-muted">
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{ad.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {ad.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={statusConfig[ad.status].variant} className="text-[10px]">
                      {statusConfig[ad.status].label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => openEdit(ad)} className="gap-2 text-xs">
                          <Pencil className="h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive gap-2 text-xs"
                          onClick={() => setDeleteAd(ad)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Tags */}
                {ad.keywords && ad.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ad.keywords.slice(0, 3).map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {kw}
                      </span>
                    ))}
                    {ad.keywords.length > 3 && (
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{ad.keywords.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    <span className="font-medium">{ad.bid_amount?.toFixed(2) ?? "0.00"}</span>
                    {ad.category && (
                      <>
                        <span className="mx-1.5 text-border">|</span>
                        <span>{ad.category}</span>
                      </>
                    )}
                  </div>
                  {ad.product_url && (
                    <a
                      href={ad.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                    >
                      Visit
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editAd} onOpenChange={() => setEditAd(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Ad</DialogTitle>
            <DialogDescription>Update your ad creative details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium">Title</Label>
              <Input
                value={editForm.title ?? ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={editForm.description ?? ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Product URL</Label>
                <Input
                  type="url"
                  value={editForm.product_url ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, product_url: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Bid Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.bid_amount ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bid_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={editForm.image_url ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              {editForm.image_url && (
                <div className="mt-2 w-full h-24 rounded-xl overflow-hidden bg-muted">
                  <img src={editForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Category</Label>
                <Input
                  value={editForm.category ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Status</Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editForm.status ?? "draft"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as AdStatus })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Keywords (comma-separated)</Label>
              <Input
                value={editForm.keywords?.join(", ") ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    keywords: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="rounded-xl"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditAd(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading} className="rounded-xl gradient-primary text-white hover:opacity-90">
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!deleteAd} onOpenChange={() => setDeleteAd(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Ad</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteAd?.title}&rdquo;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAd(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading} className="rounded-xl">
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
