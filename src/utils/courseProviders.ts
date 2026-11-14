export interface CourseProvider {
  name: string;
  lightImage: string;
  darkImage: string;
  white?: string;
  /** Override rendered height on the hero logo strip (e.g. for logos with large built-in whitespace) */
  whiteHeight?: { xs: string; md: string };
}

const partnerLogosDir = 'images/partner_logos';

// Active providers (5). Add Skillshare when its scraper pipeline is live.
// TODO: replace placeholder lightImage/darkImage paths for Udemy and Pluralsight
//       once colour logos are available in public/images/partner_logos/.
export const COURSE_PROVIDERS: CourseProvider[] = [
  {
    name: 'Coursera',
    lightImage: `${partnerLogosDir}/coursera.svg`,
    darkImage: `${partnerLogosDir}/coursera.svg`,
    white: `${partnerLogosDir}/coursera-logo-white-rgb.svg`,
  },
  {
    name: 'edX',
    lightImage: `${partnerLogosDir}/edx.png`,
    darkImage: `${partnerLogosDir}/edx.png`,
    white: `${partnerLogosDir}/edx-white.png`,
    whiteHeight: { xs: '28px', md: '36px' },
  },
  {
    name: 'DataCamp',
    lightImage: `${partnerLogosDir}/datacamp.png`,
    darkImage: `${partnerLogosDir}/datacamp.png`,
    white: `${partnerLogosDir}/datacamp-monochrome-inverted.svg`,
    whiteHeight: { xs: '18px', md: '22px' },
  },
  {
    name: 'Udemy',
    // TODO: add colour logo — use white version as fallback until available
    lightImage: `${partnerLogosDir}/udemy-white.png`,
    darkImage: `${partnerLogosDir}/udemy-white.png`,
    white: `${partnerLogosDir}/udemy-white.png`,
  },
  {
    name: 'Pluralsight',
    // TODO: add colour logo — use white version as fallback until available
    lightImage: `${partnerLogosDir}/pluralsight-white.png`,
    darkImage: `${partnerLogosDir}/pluralsight-white.png`,
    white: `${partnerLogosDir}/pluralsight-white.png`,
    whiteHeight: { xs: '36px', md: '46px' },
  },
];
