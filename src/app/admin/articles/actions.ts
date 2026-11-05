"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t || undefined;
}

/** Tạo slug chuẩn SEO từ tiêu đề tiếng Việt: bỏ dấu, chữ thường, nối bằng "-". */
function slugify(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function revalidate(slug?: string) {
  revalidatePath("/kinh-nghiem");
  revalidatePath("/");
  if (slug) revalidatePath(`/kinh-nghiem/${slug}`);
}

export async function upsertArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = s(formData.get("id"));
  const title = s(formData.get("title"));
  const content = s(formData.get("content"));
  if (!title) return { error: "Vui lòng nhập tiêu đề bài viết." };
  if (!content) return { error: "Vui lòng nhập nội dung bài viết." };

  let slug = s(formData.get("slug"));
  slug = slug ? slugify(slug) : slugify(title);
  if (!slug) return { error: "Không tạo được đường dẫn từ tiêu đề." };

  // Slug phải duy nhất (trừ chính bài đang sửa).
  const dup = await prisma.article.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (dup) return { error: `Đường dẫn "${slug}" đã dùng cho bài khác — hãy đổi slug.` };

  const data = {
    title,
    slug,
    topic: s(formData.get("topic")) ?? null,
    excerpt: s(formData.get("excerpt")) ?? null,
    content,
    coverImage: s(formData.get("coverImage")) ?? null,
    published: formData.get("published") === "on",
  };

  try {
    if (id) await prisma.article.update({ where: { id }, data });
    else await prisma.article.create({ data });
  } catch {
    return { error: "Lưu bài viết thất bại." };
  }
  revalidate(slug);
  revalidatePath("/admin/articles");
  return { ok: true, message: id ? "Đã lưu bài viết" : "Đã đăng bài viết" };
}

export async function deleteArticle(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return;
  const a = await prisma.article.delete({ where: { id } }).catch(() => null);
  revalidate(a?.slug);
  revalidatePath("/admin/articles");
}

export async function toggleArticlePublished(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData.get("id"));
  if (!id) return;
  const a = await prisma.article.findUnique({ where: { id } });
  if (!a) return;
  await prisma.article.update({ where: { id }, data: { published: !a.published } });
  revalidate(a.slug);
  revalidatePath("/admin/articles");
}
