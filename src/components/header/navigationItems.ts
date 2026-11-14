export interface NavigationItem {
  title: string;
  href: string;
  isExternal?: boolean;
  rel?: string;
  isNew?: boolean;
}

export const navigationItems: NavigationItem[] = [
  { title: "About Us", href: "/about-us" },
  {
    title: "Blog",
    href: "https://coursecorrect.fyi/blog",
    isExternal: true,
    rel: "noopener" // Removed noreferrer to preserve analytics on blog
  },
  {
    title: "Learning Path",
    href: "/get-learning-path",
    isNew: true
  },
];