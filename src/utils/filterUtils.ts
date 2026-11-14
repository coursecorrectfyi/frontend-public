// Shared filter options and utilities
// This file centralizes filter configuration to avoid duplication

export interface FilterOptions {
  levels: string[];
  languages: string[];
  providers: string[];
}

export interface FilterState {
  levels: string[];
  languages: string[];
  providers: string[];
}

// Default filter options that can be used across the application
export const defaultFilterOptions: FilterOptions = {
  levels: ['Beginner', 'Intermediate', 'Advanced'],
  languages: [
    'English', 'Hindi', 'Chinese', 'Arabic',
    'Dutch', 'French', 'German', 'Indonesian',
    'Japanese', 'Russian', 'Portuguese', 'Tamil',
    'Turkish', 'Vietnamese',
  ],
  providers: [
    "Coursera", "Skillshare", "edX", "DataCamp", "Udemy", "Pluralsight", "YouTube",
    "Google Cloud Skills Boost", "LinkedIn Learning", "Microsoft Learn", "AWS Skill Builder", "Cisco Networking Academy",
    "Codecademy", "Udacity", "Kaggle", "MATLAB Academy", "MIT OpenCourseWare", "MongoDB University", "OpenWHO", "PentesterAcademy", "Qwiklabs", "Stanford OpenEdx", "Study.com", "freeCodeCamp"
  ]
};

// Default filter state with English preselected
export const defaultFilterState: FilterState = {
  levels: [],
  languages: ['English'],
  providers: []
};

// Helper function to normalize filter values (e.g., converting levels to lowercase)
export const normalizeFilters = (filters: FilterState): FilterState => {
  return {
    ...filters,
    levels: filters.levels.map(level => level.toLowerCase())
  };
};
