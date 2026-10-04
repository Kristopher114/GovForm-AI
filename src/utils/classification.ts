export const detectFormTypeByKeywords = (fullText: string): string => {
  const upperText = fullText.toUpperCase();

  // 1. COMELEC Voter Registration Form (CEF-1A) - Check this FIRST because it mentions "Live Birth" and "Marriage" inside it!
  if (upperText.includes("COMMISSION ON ELECTIONS") && upperText.includes("CEF")) {
    return "COMELEC Voter Registration Form (CEF-1A)";
  }
  
  // 2. COMELEC Transfer / Updating of Data
  if (upperText.includes("SUPPLEMENTARY/UPDATING") || upperText.includes("EXISTING REGISTRATION RECORDS")) {
    return "COMELEC Application for Transfer of Registration";
  }

  // 3. PHILHEALTH PMRF
  if (upperText.includes("PHILHEALTH IDENTIFICATION NUMBER") || upperText.includes("PMRF") || upperText.includes("PHILHEALTH WENS")) {
    return "PHILHEALTH Member Registration Form (PMRF)";
  }
  
  // 4. Senior Citizen Form
  if (upperText.includes("NATIONAL COMMISSION OF SENIOR CITIZENS") || upperText.includes("OCTOGENARIAN")) {
    return "Senior Citizen Registration Form";
  }

  // 5. Birth Certificate (Checked later to avoid false positives from other forms requiring it)
  if (upperText.includes("BIRTH CERTIFICATE") || upperText.includes("LIVE BIRTH")) {
    return "PSA Application Form for Birth Certificate";
  }
  
  // 6. Marriage Certificate
  if (upperText.includes("MARRIAGE CERTIFICATE") || upperText.includes("MARCANE CERTIFICATE")) {
    return "PSA Application Form for Marriage Certificate";
  }
  
  // 7. Death Certificate
  if (upperText.includes("DEATH CERTIFICATE")) {
    return "PSA Application Form for Death Certificate";
  }

  return "UNKNOWN";
};

export const getFormSummary = (formType: string): string => {
  switch (formType) {
    case "PSA Application Form for Birth Certificate":
      return "This is an official request form used by the Philippine Statistics Authority (PSA) to issue a certified copy of a birth certificate. It collects the requester's details, the document owner's details, and specific registry data.";
    case "PSA Application Form for Marriage Certificate":
      return "This is an official request form used by the PSA to issue a certified copy of a marriage certificate. It requires the names of the spouses, the date and place of marriage, and requester details.";
    case "PSA Application Form for Death Certificate":
      return "This is an official request form used by the PSA to issue a certified copy of a death certificate. It collects the deceased's details, date and place of death, and the requester's relationship to the deceased.";
    case "PSA Application Form (Back Page)":
      return "This is the back page of a standard PSA Application Form. It contains the Requester's Details section and the official Privacy Notice.";
    case "COMELEC Voter Registration Form (CEF-1A)":
      return "This is the primary application form for registering to vote in the Philippines. It collects personal demographics, citizenship status, biometrics (thumbprints), and a sworn oath of eligibility.";
    case "COMELEC Application for Transfer of Registration":
      return "This is a supplementary COMELEC form used by existing voters to transfer their registration records to a new precinct, municipality, or update their existing data.";
    case "PHILHEALTH Member Registration Form (PMRF)":
      return "This form is used to register or update membership records with PhilHealth. It requires personal details, employment information, and dependent declarations for health insurance coverage.";
    case "Senior Citizen Registration Form":
      return "An application form submitted to the National Commission of Senior Citizens (NCSC) to claim benefits under the Octogenarian, Nonagenarian, and Centenarian Benefit Program.";
    default:
      return "A scanned document processed by GovForm-AI.";
  }
};
