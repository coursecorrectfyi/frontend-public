/**
 * Team members on the About Us page.
 *
 * The values here are placeholders. Production replaces this file at deploy time with the real content, which is
 * kept out of this repository (people's names, photos and contact details). Keep the exported names and types stable:
 * the replacement must satisfy them, and the deploy typechecks it.
 */

export interface TeamMember {
  name: string
  designation: string
  description: string
  /** Former employers, e.g. "Ex - Example Corp" */
  experience: string
  /** Path under public/, e.g. "/images/team/alex.jpeg" */
  image: string
  /** Optional profile link; the card links to it in a new tab */
  profileLink?: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Alex Example",
    designation: "Co-founder and CTO",
    description: "The Tech Wizard who turns ambitious concepts into game-changing reality!",
    experience: "Ex - Example Corp",
    image: "/images/avatar-placeholder.svg",
  },
  {
    name: "Sam Placeholder",
    designation: "Co-founder and CSO",
    description: "Growth hacker who blends business savvy with relentless drive to supercharge partnerships and alliances.",
    experience: "Ex - Example Corp",
    image: "/images/avatar-placeholder.svg",
  },
  {
    name: "Jordan Sample",
    designation: "Co-founder and CMO",
    description: "Marketing expert who turns clever strategies into captivating brand magic!",
    experience: "Ex - Example Corp",
    image: "/images/avatar-placeholder.svg",
  },
  {
    name: "Taylor Demo",
    designation: "Co-founder and CEO",
    description: "Product Marketing Pro who steers CourseCorrect with a visionary roadmap!",
    experience: "Ex - Example Corp",
    image: "/images/avatar-placeholder.svg",
  },
]
