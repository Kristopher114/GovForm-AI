// The written summaries of the supported forms (src/data/form-summaries.json).
// A summary is shown to normal users only when its status is "approved".
// Drafts are shown only when research mode's "show draft summaries" is on.
import formData from "@/data/form-summaries.json";

// Saved in a scan's formId when the user said it is NOT one of the supported forms.
export const FORM_NONE = "none";

export type SummaryLanguageKey = "en" | "tl" | "ceb";

export interface FormSummaryText {
  title: string;
  purpose: string;
  who_files: string;
  prepare: string[];
  sections: string[];
  where_to_submit: string;
  reminder: string;
}

export interface FormInfo {
  id: string;
  form_name: string;
  agency: string;
  status: string; // "draft" | "approved"
  last_checked: string;
  cues: string[][];
  summary: Partial<Record<SummaryLanguageKey, FormSummaryText>>;
}

const forms = (formData as { forms: FormInfo[] }).forms;

export const getForms = (): FormInfo[] => forms;

export const getFormById = (
  id: string | null | undefined,
): FormInfo | undefined => (id ? forms.find((f) => f.id === id) : undefined);

// The app's language names -> the keys used in the summaries file.
export const languageKey = (language: string): SummaryLanguageKey =>
  language === "English" ? "en" : language === "Tagalog" ? "tl" : "ceb";

export interface SummaryView {
  form: FormInfo;
  text: FormSummaryText | null; // null = nothing to show (not approved, or no text in this language)
  isDraft: boolean;
}

export const getSummaryView = (
  formId: string | null | undefined,
  language: string,
  allowDrafts: boolean,
): SummaryView | null => {
  const form = getFormById(formId);
  if (!form) return null;

  const text = form.summary[languageKey(language)] ?? null;
  const approved = form.status === "approved";
  if (!text || (!approved && !allowDrafts))
    return { form, text: null, isDraft: !approved };
  return { form, text, isDraft: !approved };
};
