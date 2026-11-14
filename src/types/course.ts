export interface CourseProperties {
  cc_source: string;
  cc_source_id: number;
  cc_source_section: string;
  cc_source_slug: string;
  cc_source_title: string;
  course_avg_rating: number;
  course_certificate: boolean;
  course_id: number;
  course_institution: string;
  course_is_classroom: boolean;
  course_is_free: boolean;
  course_is_university: boolean;
  course_language: string;
  course_level: string;
  course_name: string;
  course_num_rating: number;
  course_provider: string;
  course_slug: string;
  course_subject: string;
  course_type: string;
  page_no: number;
  position: number;
}

export interface JobRole {
  title: string;
  description: string;
  salaryRange: string;
  experienceRequirements: string[];
}

export interface CareerInsights {
  complementarySkills: string[];
  growthPotential: string[];
  jobRoles: JobRole[];
}

export interface ReviewInsights {
  pros: string[];
  cons: string[];
  overallSentiment: string;
  representativeQuotes: string[];
}

export interface AIInsights {
  keywords: string[];
  careerInsights: CareerInsights;
  reviewInsights: ReviewInsights;
  updatedAt: string;
}

export interface Course {
  _id: string;
  cc_imageUrl: string;
  courseDescription: string;
  courseImageFilename: string;
  courseImageUrl: string;
  courseUrl: string;
  duration: string;
  properties: CourseProperties;
  redirectUrl: string;
  sourceUrl: string;
  subjects: string[];
  topic: string;
  userLiked?: boolean;
  aiInsights?: AIInsights;
}

export interface BackendCourse {
  pageContent: string;
  metadata: Course;
}

export interface SearchResults {
  data: {
    dataResult: BackendCourse[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
  message: string;
}

export interface SavedCoursesResponse {
  data: {
    fetchItems: Course[];
    totalCount: number;
    currentPage: number;
    pageSize: number;
  };
  message: string;
}

export interface Review {
  title: string;
  review_stars: string;
  datetime: string;
  review: string;
}

export interface CourseDetails {
  _id: string;
  cc_imageUrl: string;
  properties: {
    course_name: string;
    course_provider: string;
    course_level: string;
    course_language: string;
    course_avg_rating: number;
    course_num_rating: number;
    course_is_free: boolean;
  };
  duration: string;
  courseDetails: {
    course_details: {
      Overview: string;
      Syllabus: string;
    };
  };
  coursesReviews: Array<Review>;
  courseUrl: string;
}

export interface CourseDetailsResponse {
  message: string;
  data: CourseDetails;
}