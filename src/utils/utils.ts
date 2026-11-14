/**
 * Converts a string to sentence case (first letter capitalized, rest lowercase)
 * @param str The input string
 * @returns The string in sentence case
 */
export const toSentenceCase = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const getBaseUrl = (): string => {
  return 'https://coursecorrect.fyi'
}

/**
 * Converts a string to title case (first letter of each word capitalized)
 * @param str The input string
 * @returns The string in title case
 */
export const toTitleCase = (str: string): string => {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function convertNumberStringToNumber(numberStr: string): number {
  const ratingMap: { [key: string]: number } = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
  };
  return ratingMap[numberStr.toLowerCase()] || 0; // Returns 0 if the rating is not recognized
}

export function generateUUID() {
  // This is a simplified UUID generator that works in all browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
