'use client';

import { Suspense } from 'react';
import { usePageViewTracking } from "@/hooks/use-analytics";

function PageViewTrackerInner() {
  usePageViewTracking();
  return null;
}

export default function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  );
} 