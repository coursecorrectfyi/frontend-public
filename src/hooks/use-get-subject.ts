import { getSubjectBySlug, type SubjectDetail } from '@/api/subjects';
import { useQuery } from '@tanstack/react-query';

export function useGetSubject(slug: string) {
  return useQuery<SubjectDetail>({
    queryKey: ['subject', slug],
    queryFn: () => getSubjectBySlug(slug),
    enabled: !!slug,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min — topic metadata rarely changes
  });
}
