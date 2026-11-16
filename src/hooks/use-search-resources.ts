import { searchResources } from '@/api/resources'
import type { ResourceFilters, ResourceSearchResponse } from '@/types/resource'
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query'

export function useSearchResources(rawQuery: string, filters: ResourceFilters, filtersReady = false) {
  // `q` is required: a blank one gets 400 "Missing required query parameter: q", so it isn't sent at all.
  const query = rawQuery.trim()
  return useInfiniteQuery({
    queryKey: ['resources', 'search', query, filters] as const,
    queryFn: ({ pageParam }) =>
      searchResources(query, filters, pageParam as string | undefined),
    getNextPageParam: (lastPage: ResourceSearchResponse) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: (previousData: InfiniteData<ResourceSearchResponse> | undefined) => previousData,
    enabled: !!query && filtersReady,
  })
}

// Convenience helper: flatten all pages into a single array
export function flattenPages(data: InfiniteData<ResourceSearchResponse> | undefined) {
  return data?.pages.flatMap(p => p.data) ?? []
}
