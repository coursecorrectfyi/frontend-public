/**
 * Testimonials, shown on the homepage and on About Us.
 *
 * The values here are placeholders. Production replaces this file at deploy time with the real content, which is
 * kept out of this repository (people's names, photos and contact details). Keep the exported names and types stable:
 * the replacement must satisfy them, and the deploy typechecks it.
 */

export interface Testimonial {
  /** Short headline */
  quote: string
  content: string
  name: string
  title: string
  /** Path under public/, e.g. "/images/testimonial/a.jpg" */
  image: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Saved me so much time.',
    content: "I used to waste hours trying to figure out what course was right for me. There are literally thousands to choose from! CourseCorrect made it easy. The AI shortlisted what I needed and I got started. I'm in the middle of the course and so far, I think it was a great choice.",
    name: 'Reviewer A.',
    title: 'Marketing Analyst',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: 'Made the process so much easier.',
    content: "I didn't know where to start when I wanted to learn something new. Plus I always thought certificates are just good to have. CourseCorrect helped me pick a course that works well with my busy schedule and the certificate I gained is what helped me land my promotion.",
    name: 'Reviewer B.',
    title: 'Aspiring Data Analyst',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "Made my life easier, that's all I'll say.",
    content: "I needed a course, didn't know which one. CourseCorrect picked one for me. I took it. It was good. 10/10 would use again.",
    name: 'Reviewer C.',
    title: 'IT Specialist',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "I didn't know where to start. Now I do.",
    content: "There are too many courses out there, and I kept putting off upskilling because I was never sure about taking a course, like — how do you even know if it's worth your time and money? CourseCorrect pointed me in the right direction with extensive reviews and helped me shortlist stuff, and I actually finished a course for once.",
    name: 'Reviewer D.',
    title: 'Project Manager',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "Finally felt confident hitting 'Enroll.'",
    content: "I've always been a bit skeptical of online courses — so many overpromise and underdeliver. CourseCorrect didn't just dump options on me, it actually explained why a course would suit my goals. I felt like I had a smart friend guiding me.",
    name: 'Reviewer E.',
    title: 'UX Designer',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: 'Took me from indecisive to done.',
    content: "I used to open five tabs, read reviews, get overwhelmed, and close everything. CourseCorrect gave me one recommendation that made sense. Took the course. No regrets.",
    name: 'Reviewer F.',
    title: 'Career Switcher (Finance → Product Management)',
    image: '/images/avatar-placeholder.svg',
  },
]
