export const CAMPUS_DEPARTMENTS = [
  "CS",
  "Mech",
  "ECE",
  "Electrical",
  "AIML",
  "Information Science",
] as const;

export type CampusDepartment = (typeof CAMPUS_DEPARTMENTS)[number];
