# Analytics Implementation Guide

## Overview

This document outlines the analytics implementation for CourseCorrect, including current tracking capabilities, setup instructions, and future enhancements.

## Current Analytics Implementation

### ✅ What's Currently Tracked

#### 1. Page Views
- **Automatic tracking** of all page views via GA4 Configuration tag
- **Page context** (home, search, course details, etc.)
- **Search query context** when applicable

#### 2. Search Behavior
- **Search queries** with exact terms
- **Search frequency** per term
- **Timestamp** of searches

#### 3. Course Interactions
- **Search result clicks** (both image and title clicks)
- **Course saves/unsaves** with course details
- **Enroll button clicks** from multiple sources:
  - Search results page
  - Course details page
  - Course dialog

#### 4. User Authentication
- **Sign-in events** with authentication method
- **User session tracking**

### 📊 Data Available in GA4

Once deployed, you can access:
- **Most popular search terms** and their frequency
- **Most clicked courses** from search results
- **Enrollment conversion rates** by source
- **Save/unsave course patterns**
- **User engagement metrics**
- **Page view analytics**

## Setup Instructions

### Prerequisites
- Google Analytics 4 property set up
- Google Tag Manager container configured
- Environment variables configured:
  - `NEXT_PUBLIC_GTM_ID`
  - `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

### Step 1: Google Tag Manager Configuration

#### 1.1 GA4 Configuration Tag
1. In GTM dashboard, go to **Tags** → **New**
2. Select **"Google Analytics: GA4 Configuration"**
3. Enter your **Measurement ID** (G-XXXXXXXXXX)
4. Set trigger to **"Initialization - All Pages"**
5. Name: `GA4 Configuration`
6. Save

#### 1.2 Custom Event Triggers
Create triggers for each event type:

| Event Name | Trigger Type | Description |
|------------|--------------|-------------|
| `search` | Custom Event | User searches for courses |
| `search_result_click` | Custom Event | User clicks on search result |
| `enroll_click` | Custom Event | User clicks enroll button |
| `save_course` | Custom Event | User saves/unsaves course |
| `user_sign_in` | Custom Event | User signs in |

#### 1.3 GA4 Event Tags
Create tags for each custom event:

| Tag Name | Event Name | Parameters |
|----------|------------|------------|
| `GA4 - Search Event` | `search` | `search_term`, `result_count` |
| `GA4 - Search Result Click` | `search_result_click` | `course_id`, `course_name`, `position` |
| `GA4 - Enroll Click` | `enroll_click` | `course_id`, `course_name`, `course_url`, `source` |
| `GA4 - Save Course` | `save_course` | `course_id`, `course_name`, `action` |
| `GA4 - User Sign In` | `user_sign_in` | `method` |

### Step 2: Frontend Implementation

#### 2.1 Analytics Utility Functions
Located in `src/utils/analytics.ts`:
- `trackEvent()` - Base tracking function
- `trackSearch()` - Search query tracking
- `trackSearchResultClick()` - Search result click tracking
- `trackEnrollClick()` - Enroll button click tracking
- `trackSaveCourse()` - Save course action tracking
- `trackUserSignIn()` - User sign-in tracking
- `trackPageView()` - Page view tracking

#### 2.2 Page View Tracking
- **Hook**: `src/hooks/use-analytics.ts`
- **Component**: `src/components/analytics/PageViewTracker.tsx`
- **Integration**: Added to root layout

#### 2.3 Event Tracking Integration
Tracking functions are integrated into:
- `AppSearch.tsx` - Search queries
- `CourseTableCard.tsx` - Search results and enroll buttons
- `SaveCourseButton.tsx` - Save/unsave actions
- `AuthButton.tsx` - Sign-in events
- `CourseDetailsContainer.tsx` - Course detail page interactions
- `CourseDetailsDialog.tsx` - Dialog interactions

### Step 3: Testing

#### 3.1 Local Testing
1. **Enable GTM locally**: Comment out environment check in `GoogleTagManager.tsx`
2. **Start GTM Preview**: Click "Preview" in GTM dashboard
3. **Test all events**:
   - Search for courses
   - Click search results
   - Click enroll buttons
   - Save/unsave courses
   - Sign in

#### 3.2 Production Testing
1. **Deploy code changes**
2. **Test with GTM Preview** on production URL
3. **Verify events in GA4 Real-time reports**

### Step 4: Deployment

1. **Publish GTM container** (already done)
2. **Deploy frontend code** with tracking functions
3. **Monitor GA4 Real-time** for event flow
4. **Check standard reports** after 24-48 hours

## Future Enhancements

### 🎯 High Priority

#### 1. User Engagement Tracking
- **Time on page** for search results and course details
- **Scroll depth** tracking
- **Session duration** and engagement metrics

#### 2. Conversion Funnel Analysis
- **Funnel tracking**: Search → View → Save → Enroll
- **Drop-off point identification**
- **Conversion rate optimization**

#### 3. Content Performance
- **Most popular search terms** dashboard
- **Course performance metrics**
- **Provider performance analysis**

### 🔧 Medium Priority

#### 4. Advanced User Behavior
- **Filter usage** tracking
- **Search refinement** patterns
- **Return user behavior**

#### 5. Technical Analytics
- **Page load performance** tracking
- **Error tracking** and monitoring
- **Mobile vs desktop** usage patterns

#### 6. Chat Integration
- **Chat message tracking**
- **AI interaction patterns**
- **Chat-to-enrollment conversion**

### 📈 Low Priority

#### 7. Advanced Analytics
- **A/B testing** framework
- **Personalization** tracking
- **Cohort analysis**

#### 8. Business Intelligence
- **Revenue tracking** (if applicable)
- **User lifetime value** analysis
- **Retention metrics**

## Implementation Checklist

### ✅ Completed
- [x] GTM container setup
- [x] GA4 configuration
- [x] Custom event triggers
- [x] Frontend tracking functions
- [x] Component integration
- [x] Local testing
- [x] GTM publishing

### 🔄 In Progress
- [ ] Production deployment
- [ ] Production testing
- [ ] Data validation

### 📋 Next Steps
- [ ] Monitor initial data collection
- [ ] Set up GA4 custom reports
- [ ] Implement high-priority enhancements
- [ ] Create analytics dashboard

## Troubleshooting

### Common Issues

#### Events Not Firing
- Check browser console for JavaScript errors
- Verify GTM container is published
- Ensure environment variables are set correctly

#### Data Not Appearing in GA4
- Wait 24-48 hours for data to populate
- Check GA4 Real-time reports for immediate feedback
- Verify event parameters are correctly configured

#### Preview Mode Issues
- Ensure GTM container is published
- Check for JavaScript errors in browser console
- Verify tracking functions are properly imported

### Debug Tools
- **GTM Preview Mode**: Real-time event debugging
- **Browser Dev Tools**: Console and network monitoring
- **GA4 Real-time Reports**: Immediate data validation
- **GTM Debug Console**: Detailed event analysis

## Resources

- [Google Tag Manager Documentation](https://developers.google.com/tag-manager)
- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GTM Community](https://support.google.com/tagmanager/)
- [GA4 Community](https://support.google.com/analytics/)
