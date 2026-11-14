import { getResourceById } from '@/api/resources'
import { useQuery } from '@tanstack/react-query'

export function useResourceDetail(id: string) {
  return useQuery({
    queryKey: ['resources', 'detail', id],
    queryFn: () => getResourceById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
