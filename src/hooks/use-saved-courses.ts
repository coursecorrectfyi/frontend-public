// src/hooks/use-saved-courses.ts
import { addCourseToShortlist, ERR_NO_AUTH_TOKEN, getSavedCourses, MAX_SAVED_COURSES, removeCourseFromShortlist } from '@/api/courses';
import type { LearningResource } from '@/types/resource';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

interface SaveCourseOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSavedCourses(options?: SaveCourseOptions) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Include user identity in the key so React Query treats a session change as a new query.
  const queryKey = ['saved-items', session?.user?.email ?? null] as const;

  const MAX_REACHED_MSG = `You can shortlist up to ${MAX_SAVED_COURSES} items. Please remove some before adding more.`;

  const canAddMoreCourses = useMemo(() => {
    const items = queryClient.getQueryData<LearningResource[]>(queryKey);
    return (items?.length ?? 0) < MAX_SAVED_COURSES;
  }, [queryClient, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => getSavedCourses((session as any)?.backendTokens?.token),
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const token = (session as any)?.backendTokens?.token;
      if (!token) throw new Error(ERR_NO_AUTH_TOKEN);
      if (!canAddMoreCourses) throw new Error(MAX_REACHED_MSG);
      return addCourseToShortlist(token, courseId);
    },
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LearningResource[]>(queryKey);
      const currentCount = previous?.length ?? 0;
      if (currentCount >= MAX_SAVED_COURSES) throw new Error(MAX_REACHED_MSG);
      if (previous) {
        // Placeholder entry so count is correct while the mutation is in flight.
        queryClient.setQueryData<LearningResource[]>(queryKey, [
          ...previous,
          { id: courseId } as LearningResource,
        ]);
      }
      return { previous };
    },
    onError: (err, _courseId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      options?.onError?.(err as Error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const token = (session as any)?.backendTokens?.token;
      return removeCourseFromShortlist(token, courseId);
    },
    onMutate: async (courseId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LearningResource[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<LearningResource[]>(queryKey,
          previous.filter(r => r.id !== courseId)
        );
      }
      return { previous };
    },
    onError: (err, _courseId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      options?.onError?.(err as Error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    savedItems: query.data ?? [],
    isAuthenticated,
    saveCourse: saveMutation.mutate,
    removeCourse: removeMutation.mutate,
    isMutating: saveMutation.isPending || removeMutation.isPending,
    canAddMoreCourses,
  };
}
