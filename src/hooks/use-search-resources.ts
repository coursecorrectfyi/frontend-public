import { searchResources } from '@/api/resources'
import type { ResourceFilters, ResourceSearchResponse } from '@/types/resource'
import { InfiniteData, useInfiniteQuery } from '@tanstack/react-query'

export function useSearchResources(query: string, filters: ResourceFilters, filtersReady = false) {
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
