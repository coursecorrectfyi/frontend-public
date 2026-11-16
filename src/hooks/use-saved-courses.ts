// src/hooks/use-saved-courses.ts
import { addCourseToShortlist, ERR_NO_AUTH_TOKEN, getSavedCourses, MAX_SAVED_COURSES, removeCourseFromShortlist } from '@/api/courses';
import type { LearningResource } from '@/types/resource';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from './use-auth';

interface SaveCourseOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSavedCourses(options?: SaveCourseOptions) {
  const { status: authStatus, isSignedIn: isAuthenticated, userId, getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  // The user's id is part of the key, so another account signed in on the same page never sees the previous
  // account's cached items (the session has no email: keying on it shared one cache entry between users, B15).
  const queryKey = useMemo(() => ['saved-items', userId] as const, [userId]);

  const MAX_REACHED_MSG = `You can shortlist up to ${MAX_SAVED_COURSES} items. Please remove some before adding more.`;

  const query = useQuery({
    queryKey,
    queryFn: async () => getSavedCourses((await getAccessToken()) ?? ''),
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const canAddMoreCourses = (query.data?.length ?? 0) < MAX_SAVED_COURSES;

  const saveMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const token = await getAccessToken();
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
      return removeCourseFromShortlist((await getAccessToken()) ?? '', courseId);
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
    /** `loading` while the session is being resolved: show placeholders, not the sign-in prompt (B6). */
    authStatus,
    saveCourse: saveMutation.mutate,
    removeCourse: removeMutation.mutate,
    isMutating: saveMutation.isPending || removeMutation.isPending,
    canAddMoreCourses,
  };
}
