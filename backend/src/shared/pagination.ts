import { z } from "zod";

/**
 * Cursor pagination primitives — no generic framework.
 * Cursor is opaque base64 of { createdAt, id } for stable ordering.
 */

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type CursorPayload = { createdAt: string; id: string };

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export type PageResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export function buildPage<T extends { id: string; createdAt: Date | string }>(
  items: T[],
  limit: number,
): PageResult<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && pageItems.length > 0
      ? encodeCursor({
          createdAt:
            pageItems[pageItems.length - 1]!.createdAt instanceof Date
              ? (pageItems[pageItems.length - 1]!.createdAt as Date).toISOString()
              : (pageItems[pageItems.length - 1]!.createdAt as string),
          id: pageItems[pageItems.length - 1]!.id,
        })
      : null;
  return { items: pageItems, nextCursor };
}
