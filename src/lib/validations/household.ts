import { z } from "zod";

export const householdSchema = z.object({
  name: z.string().min(1, "Household name is required"),
  filingStatus: z.enum(["SINGLE", "MARRIED_FILING_JOINTLY", "MARRIED_FILING_SEPARATELY", "HEAD_OF_HOUSEHOLD"]),
  stateOfResidence: z.string().min(2, "State is required"),
  planningMode: z.enum(["INDIVIDUAL", "COUPLE"]),
});

export const memberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  relationshipType: z.enum(["PRIMARY", "SPOUSE", "DEPENDENT"]),
  dateOfBirth: z.string().refine((val) => {
    const date = new Date(val);
    const now = new Date();
    const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return age >= 18 && age <= 100;
  }, "Must be between 18 and 100 years old"),
  retirementTargetAge: z
    .number()
    .min(50, "Retirement age must be at least 50")
    .max(80, "Retirement age must be at most 80"),
  lifeExpectancy: z
    .number()
    .min(60, "Life expectancy must be at least 60")
    .max(120, "Life expectancy must be at most 120")
    .default(90),
});

export type HouseholdInput = z.infer<typeof householdSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
