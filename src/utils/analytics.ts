// Analytics utility functions for GTM
declare global {
    interface Window {
        dataLayer: any[];
    }
}

export const trackEvent = (eventName: string, parameters: Record<string, any> = {}) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            timestamp: new Date().toISOString(),
            ...parameters
        });
    }
};

// Specific tracking functions
export const trackSearch = (searchTerm: string, resultCount?: number) => {
    trackEvent('search', {
        search_term: searchTerm,
        result_count: resultCount,
    });
};

export const trackSearchResultClick = (courseId: string, courseName: string, position: number, source: string = 'search_results') => {
    trackEvent('search_result_click', {
        course_id: courseId,
        course_name: courseName,
        position: position,
        source: source,
    });
};

export const trackEnrollClick = (courseId: string, courseName: string, courseUrl: string, source: string) => {
    trackEvent('enroll_click', {
        course_id: courseId,
        course_name: courseName,
        course_url: courseUrl,
        source: source,
    });
};

export const trackSaveCourse = (courseId: string, courseName: string, action: 'save' | 'unsave') => {
    trackEvent('save_course', {
        course_id: courseId,
        course_name: courseName,
        action: action,
    });
};

export const trackUserSignIn = (method: string) => {
    trackEvent('user_sign_in', {
        method: method,
    });
};

export const trackPageView = (pageName: string, customParameters?: Record<string, any>) => {
    trackEvent('page_view', {
        page_name: pageName,
        ...customParameters,
    });
};

export const trackSearchResultsLoaded = (searchTerm: string, resultCount: number, vectorSearch: boolean) => {
    trackEvent('search_results_loaded', {
        search_term: searchTerm,
        result_count: resultCount,
        has_results: resultCount > 0,
        vector_search: vectorSearch,
    });
};

export const trackSearchError = (searchTerm: string, errorMessage: string) => {
    trackEvent('search_error', {
        search_term: searchTerm,
        error_message: errorMessage,
    });
};