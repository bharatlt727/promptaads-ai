"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { adsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const adSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  product_url: z.string().url("Must be a valid URL"),
  category: z.string().optional(),
  keywords: z.string().optional(),
  bid_amount: z.coerce.number().min(0.01, "Minimum bid is $0.01"),
});

type AdFormValues = z.infer<typeof adSchema>;

export default function NewAdPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      title: "",
      description: "",
      product_url: "",
      category: "",
      keywords: "",
      bid_amount: 0.5,
    },
  });

  async function onSubmit(values: AdFormValues) {
    if (!token) return;
    setError("");
    try {
      await adsApi.create(token, {
        title: values.title,
        description: values.description,
        product_url: values.product_url,
        category: values.category || undefined,
        keywords: values.keywords
          ? values.keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        bid_amount: values.bid_amount,
      });
      router.push("/dashboard/ads");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ad");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Ad</h1>
          <p className="text-muted-foreground">
            Set up a new ad creative for AI-powered matching
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad Details</CardTitle>
          <CardDescription>
            Fill in your ad information. The AI engine will rewrite it to naturally
            fit each user&apos;s context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Build websites visually"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your product or service. The AI engine will adapt this to each context."
                rows={4}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Product URL */}
            <div className="space-y-2">
              <Label htmlFor="product_url">Product URL</Label>
              <Input
                id="product_url"
                type="url"
                placeholder="https://yourproduct.com"
                {...register("product_url")}
              />
              {errors.product_url && (
                <p className="text-xs text-destructive">{errors.product_url.message}</p>
              )}
            </div>

            {/* Category & Bid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. SaaS, E-commerce"
                  {...register("category")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid_amount">Bid Amount ($)</Label>
                <Input
                  id="bid_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register("bid_amount")}
                />
                {errors.bid_amount && (
                  <p className="text-xs text-destructive">{errors.bid_amount.message}</p>
                )}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">
                Keywords{" "}
                <span className="font-normal text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id="keywords"
                placeholder="website builder, no-code, web design"
                {...register("keywords")}
              />
              <p className="text-xs text-muted-foreground">
                These help the engine match your ad to relevant prompts
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Link href="/dashboard/ads">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Ad
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
