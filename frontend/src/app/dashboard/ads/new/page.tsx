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
import { ArrowLeft, Loader2, AlertCircle, ImageIcon, Sparkles } from "lucide-react";
import { adsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const adSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  product_url: z.string().url("Must be a valid URL"),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdFormValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      title: "",
      description: "",
      product_url: "",
      image_url: "",
      category: "",
      keywords: "",
      bid_amount: 0.5,
    },
  });

  const imageUrl = watch("image_url");

  async function onSubmit(values: AdFormValues) {
    if (!token) return;
    setError("");
    try {
      await adsApi.create(token, {
        title: values.title,
        description: values.description,
        product_url: values.product_url,
        image_url: values.image_url || undefined,
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
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ads">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Ad</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set up a new ad creative for AI-powered matching
          </p>
        </div>
      </div>

      <Card className="border-0 bg-card">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm shadow-primary/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Ad Details</CardTitle>
              <CardDescription className="text-xs">
                The AI engine will adapt your ad text to fit each user&apos;s context
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-medium">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Build websites visually"
                className="rounded-xl h-11"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-medium">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your product or service. The AI engine will adapt this to each context."
                rows={4}
                className="rounded-xl"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Product URL */}
            <div className="space-y-2">
              <Label htmlFor="product_url" className="text-xs font-medium">Product URL</Label>
              <Input
                id="product_url"
                type="url"
                placeholder="https://yourproduct.com"
                className="rounded-xl h-11"
                {...register("product_url")}
              />
              {errors.product_url && (
                <p className="text-xs text-destructive">{errors.product_url.message}</p>
              )}
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image_url" className="text-xs font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3" />
                Ad Image URL
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="image_url"
                type="url"
                placeholder="https://example.com/your-ad-image.jpg"
                className="rounded-xl h-11"
                {...register("image_url")}
              />
              {errors.image_url && (
                <p className="text-xs text-destructive">{errors.image_url.message}</p>
              )}
              {imageUrl && (
                <div className="mt-2 w-full h-32 rounded-xl overflow-hidden bg-muted">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Provide a URL to an image that will be shown with your ad
              </p>
            </div>

            {/* Category & Bid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs font-medium">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. SaaS, E-commerce"
                  className="rounded-xl h-11"
                  {...register("category")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid_amount" className="text-xs font-medium">Bid Amount ($)</Label>
                <Input
                  id="bid_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="rounded-xl h-11"
                  {...register("bid_amount")}
                />
                {errors.bid_amount && (
                  <p className="text-xs text-destructive">{errors.bid_amount.message}</p>
                )}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords" className="text-xs font-medium">
                Keywords{" "}
                <span className="font-normal text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id="keywords"
                placeholder="website builder, no-code, web design"
                className="rounded-xl h-11"
                {...register("keywords")}
              />
              <p className="text-[11px] text-muted-foreground">
                These help the engine match your ad to relevant prompts
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <Link href="/dashboard/ads">
                <Button type="button" variant="outline" className="rounded-xl">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl gradient-primary text-white hover:opacity-90 shadow-md shadow-primary/20 gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Ad
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
