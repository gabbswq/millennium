'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { PaginatedArticles } from '@/types/content'

export const PAGE_SIZE = 9

interface FetchOptions {
  page: number
  tagSlug: string
}

async function fetchArticles({ page, tagSlug }: FetchOptions): Promise<PaginatedArticles> {
  const supabase = createClient()
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let query = supabase
    .from('public_articles')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(from, to)

  if (tagSlug) {
    // The `tags` column in public_articles is JSONB: [{id, name, slug}, ...].
    // `cs` maps to Postgres @> (contains) for JSONB.
    query = query.filter('tags', 'cs', JSON.stringify([{ slug: tagSlug }]))
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  const total = count ?? 0

  return {
    articles: (data ?? []).map(row => ({ ...row, author_name: row.author_name ?? undefined,
      tags: Array.isArray(row.tags) ? row.tags.flatMap(tag =>
        tag && typeof tag === 'object' && !Array.isArray(tag) && typeof tag.id === 'string' && typeof tag.name === 'string' && typeof tag.slug === 'string'
          ? [{ id: tag.id, name: tag.name, slug: tag.slug }] : []) : [] })),
    total,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  }
}

interface UseArticlesOptions {
  page?: number
  tagSlug?: string
}

interface UseArticlesResult extends Partial<PaginatedArticles> {
  loading: boolean
  error: Error | null
}

/**
 * Fetches a paginated list of published articles, optionally filtered by tag.
 * Uses SWR for automatic caching and stale-while-revalidate behaviour.
 *
 * @example
 * const { articles, totalPages, loading } = useArticles({ page: 2, tagSlug: 'ia' })
 */
export function useArticles({
  page = 1,
  tagSlug = '',
}: UseArticlesOptions = {}): UseArticlesResult {
  const key = ['articles', page, tagSlug]

  const { data, error, isLoading } = useSWR<PaginatedArticles>(
    key,
    () => fetchArticles({ page, tagSlug }),
    {
      revalidateOnFocus: false,
      // Keep previous page data while next page loads (no flash).
      keepPreviousData: true,
    },
  )

  return {
    ...(data ?? {}),
    loading: isLoading,
    error:   error ?? null,
  }
}
