"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import { adsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Ad, AdStatus, AdUpdate } from "@/types";

const statusVariant: Record<AdStatus, "success" | "warning" | "secondary" | "destructive"> = {
  active: "success",
  paused: "warning",
  draft: "secondary",
  archived: "destructive",
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ads Manager</h1>
          <p className="text-muted-foreground">Create and manage your ad creatives</p>
        </div>
        <Link href="/dashboard/ads/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
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
            className="pl-9"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No ads yet</h3>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              Create your first ad and it will be semantically matched to relevant AI prompts.
            </p>
            <Link href="/dashboard/ads/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Ad
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAds.map((ad) => (
            <Card key={ad.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{ad.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {ad.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={statusVariant[ad.status]}>{ad.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(ad)}>
                          <Pencil className="mr-2 h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteAd(ad)}
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Keywords */}
                  {ad.keywords && ad.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ad.keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                      {ad.keywords.length > 4 && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{ad.keywords.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Bid: ${ad.bid_amount?.toFixed(2) ?? "0.00"}</span>
                    {ad.category && <span>{ad.category}</span>}
                  </div>

                  {/* URL */}
                  {ad.product_url && (
                    <a
                      href={ad.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{ad.product_url}</span>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Ad</DialogTitle>
            <DialogDescription>Update your ad creative details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.title ?? ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description ?? ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product URL</Label>
                <Input
                  type="url"
                  value={editForm.product_url ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, product_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bid Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.bid_amount ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bid_amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={editForm.category ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Label>Keywords (comma-separated)</Label>
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
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditAd(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!deleteAd} onOpenChange={() => setDeleteAd(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Ad</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteAd?.title}&rdquo;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAd(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
