import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^https:\/\//i.test(value), "Only HTTPS URLs are allowed")
  .optional()
  .or(z.literal(""));

export const submissionSchema = z
  .object({
    form_page: z.enum(["footer", "get_in_touch", "discovery_section", "service", "faq"]),
    full_name: optionalText(120),
    email: z.string().trim().email().max(254),
    phone_number: optionalText(40),
    select_service: optionalText(120),
    budget_range: optionalText(80),
    inquiry: optionalText(5000),
    consent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.form_page !== "footer" && !value.full_name) {
      ctx.addIssue({ code: "custom", path: ["full_name"], message: "Full name is required" });
    }
    if (value.form_page !== "footer" && !value.inquiry) {
      ctx.addIssue({ code: "custom", path: ["inquiry"], message: "Inquiry is required" });
    }
    if (value.form_page === "service") {
      for (const field of ["phone_number", "select_service", "budget_range"]) {
        if (!value[field]) ctx.addIssue({ code: "custom", path: [field], message: `${field} is required` });
      }
    }
    if (value.form_page === "get_in_touch" && !value.consent) {
      ctx.addIssue({ code: "custom", path: ["consent"], message: "Consent is required" });
    }
  });

export const projectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category_name: z.string().trim().min(2).max(120),
  intro: z.string().trim().min(2).max(1000),
  description: optionalText(10000),
  link: optionalUrl,
  banner: z.string().trim().min(1).max(500),
  tags: optionalText(500),
  is_published: z.boolean().default(true),
  title_en: optionalText(160),
  title_fa: optionalText(160),
  category_name_en: optionalText(120),
  category_name_fa: optionalText(120),
  intro_en: optionalText(1000),
  intro_fa: optionalText(1000),
  description_en: optionalText(10000),
  description_fa: optionalText(10000),
  tags_en: optionalText(500),
  tags_fa: optionalText(500),
  challenge_en: optionalText(5000),
  challenge_fa: optionalText(5000),
  solution_en: optionalText(5000),
  solution_fa: optionalText(5000),
  outcome_en: optionalText(5000),
  outcome_fa: optionalText(5000),
  duration_en: optionalText(160),
  duration_fa: optionalText(160),
  team_role_en: optionalText(500),
  team_role_fa: optionalText(500),
  results_en: optionalText(5000),
  results_fa: optionalText(5000),
  testimonial_quote_en: optionalText(3000),
  testimonial_quote_fa: optionalText(3000),
  testimonial_name_en: optionalText(160),
  testimonial_name_fa: optionalText(160),
  testimonial_role_en: optionalText(240),
  testimonial_role_fa: optionalText(240),
});

export const projectImageSchema = z.object({
  path: z.string().trim().min(1).max(500),
  alt_text: optionalText(250),
  alt_text_en: optionalText(250),
  alt_text_fa: optionalText(250),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
});

export const projectImageUpdateSchema = z.object({
  alt_text: optionalText(250),
  alt_text_en: optionalText(250),
  alt_text_fa: optionalText(250),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
});

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(120),
  bio: optionalText(3000),
  profile: z.string().trim().min(1).max(500),
  github: optionalUrl,
  twitter: optionalUrl,
  linkedin: optionalUrl,
  sort_order: z.number().int().min(0).max(10000).default(0),
  is_published: z.boolean().default(true),
  name_en: optionalText(120),
  name_fa: optionalText(120),
  position_en: optionalText(120),
  position_fa: optionalText(120),
  bio_en: optionalText(3000),
  bio_fa: optionalText(3000),
});

export const analyticsVisitSchema = z.object({
  session_id: z.string().trim().uuid().max(100),
  path: z.string().trim().startsWith("/").max(500),
  referrer: optionalText(1000),
});

export function normalizeSubmission(body) {
  const booleanValue = (value) => value === true || value === "true" || value === "on" || value === 1;
  return {
    form_page: body.form_page,
    full_name: body.full_name ?? body.Full_Name ?? "",
    email: body.email ?? body.Email ?? "",
    phone_number: body.phone_number ?? body.Phone_Number ?? "",
    select_service: body.select_service ?? body.Select_Service ?? "",
    budget_range: body.budget_range ?? body.Budget_Range ?? "",
    inquiry: body.inquiry ?? body.Inquiry ?? "",
    consent: booleanValue(body.consent ?? body.Agree_terms),
  };
}
