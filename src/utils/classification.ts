// Document Classification: Keyword detection and form metadata
// Restored and adapted from working pre-merge implementation with ID mapping

export const FORM_TYPE_TO_ID: Record<string, string> = {
  "PSA Application Form for Birth Certificate": "psa-birth",
  "PSA Application Form for Marriage Certificate": "psa-marriage",
  "PSA Application Form for Death Certificate": "psa-death",
  "COMELEC Voter Registration Form (CEF-1A)": "comelec-cef1",
  "COMELEC Application for Transfer of Registration": "comelec-supp",
  "PHILHEALTH Member Registration Form (PMRF)": "philhealth-pmrf",
  "Senior Citizen Registration Form": "ncsc-octo",
  "psa-birth": "psa-birth",
  "psa-marriage": "psa-marriage",
  "psa-death": "psa-death",
  "comelec-cef1": "comelec-cef1",
  "comelec-supp": "comelec-supp",
  "philhealth-pmrf": "philhealth-pmrf",
  "ncsc-octo": "ncsc-octo",
};

export const FORM_ID_TO_DISPLAY_NAME: Record<string, string> = {
  "psa-birth": "PSA Application Form for Birth Certificate",
  "psa-marriage": "PSA Application Form for Marriage Certificate",
  "psa-death": "PSA Application Form for Death Certificate",
  "comelec-cef1": "COMELEC Voter Registration Form (CEF-1A)",
  "comelec-supp": "COMELEC Application for Transfer of Registration",
  "philhealth-pmrf": "PHILHEALTH Member Registration Form (PMRF)",
  "ncsc-octo": "Senior Citizen Registration Form",
};

export const getFormIdFromType = (formType: string | null | undefined): string | null => {
  if (!formType || formType === "UNKNOWN") return null;
  return FORM_TYPE_TO_ID[formType] ?? formType;
};

export const getFormDisplayName = (formIdOrName: string | null | undefined): string => {
  if (!formIdOrName || formIdOrName === "UNKNOWN") return "Scanned Document";
  return FORM_ID_TO_DISPLAY_NAME[formIdOrName] ?? formIdOrName;
};

export const detectFormTypeByKeywords = (fullText: string): string => {
  const upperText = fullText.toUpperCase();

  // 1. COMELEC Voter Registration Form (CEF-1A) - Check first because it contains references to Birth/Marriage inside it
  if (
    (upperText.includes("COMMISSION ON ELECTIONS") || upperText.includes("COMELEC")) &&
    (upperText.includes("CEF") || upperText.includes("VOTER REGISTRATION") || upperText.includes("APPLICATION FOR REGISTRATION"))
  ) {
    return "comelec-cef1";
  }

  // 2. COMELEC Transfer / Updating of Data
  if (
    upperText.includes("SUPPLEMENTARY/UPDATING") ||
    upperText.includes("EXISTING REGISTRATION RECORDS") ||
    upperText.includes("TRANSFER OF REGISTRATION")
  ) {
    return "comelec-supp";
  }

  // 3. PHILHEALTH PMRF
  if (
    upperText.includes("PHILHEALTH IDENTIFICATION NUMBER") ||
    upperText.includes("PMRF") ||
    upperText.includes("PHILHEALTH") ||
    upperText.includes("MEMBER REGISTRATION FORM")
  ) {
    return "philhealth-pmrf";
  }

  // 4. Senior Citizen Form
  if (
    upperText.includes("NATIONAL COMMISSION OF SENIOR CITIZENS") ||
    upperText.includes("OCTOGENARIAN") ||
    upperText.includes("NONAGENARIAN") ||
    upperText.includes("CENTENARIAN") ||
    upperText.includes("SENIOR CITIZEN")
  ) {
    return "ncsc-octo";
  }

  // 5. PSA Birth Certificate
  if (
    upperText.includes("BIRTH CERTIFICATE") ||
    upperText.includes("CERTIFICATE OF LIVE BIRTH") ||
    upperText.includes("LIVE BIRTH") ||
    upperText.includes("BREN")
  ) {
    return "psa-birth";
  }

  // 6. PSA Marriage Certificate
  if (
    upperText.includes("MARRIAGE CERTIFICATE") ||
    upperText.includes("CERTIFICATE OF MARRIAGE") ||
    upperText.includes("MARCANE CERTIFICATE") ||
    upperText.includes("MREN")
  ) {
    return "psa-marriage";
  }

  // 7. PSA Death Certificate
  if (
    upperText.includes("DEATH CERTIFICATE") ||
    upperText.includes("CERTIFICATE OF DEATH") ||
    upperText.includes("DREN")
  ) {
    return "psa-death";
  }

  return "UNKNOWN";
};

export const getFormSummary = (formType: string): string => {
  const normalized = getFormIdFromType(formType) || formType;
  switch (normalized) {
    case "psa-birth":
      return "This is an official request form used by the Philippine Statistics Authority (PSA) to issue a certified copy of a birth certificate. It collects the requester's details, the document owner's details, and specific registry data.";
    case "psa-marriage":
      return "This is an official request form used by the PSA to issue a certified copy of a marriage certificate. It requires the names of the spouses, the date and place of marriage, and requester details.";
    case "psa-death":
      return "This is an official request form used by the PSA to issue a certified copy of a death certificate. It collects the deceased's details, date and place of death, and the requester's relationship to the deceased.";
    case "comelec-cef1":
      return "This is the primary application form for registering to vote in the Philippines. It collects personal demographics, citizenship status, biometrics (thumbprints), and a sworn oath of eligibility.";
    case "comelec-supp":
      return "This is a supplementary COMELEC form used by existing voters to transfer their registration records to a new precinct, municipality, or update their existing data.";
    case "philhealth-pmrf":
      return "This form is used to register or update membership records with PhilHealth. It requires personal details, employment information, and dependent declarations for health insurance coverage.";
    case "ncsc-octo":
      return "An application form submitted to the National Commission of Senior Citizens (NCSC) to claim benefits under the Octogenarian, Nonagenarian, and Centenarian Benefit Program.";
    default:
      return "A scanned document processed by GovForm-AI.";
  }
};
