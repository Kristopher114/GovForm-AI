export const detectFormTypeByKeywords = (fullText: string): string => {
  const upperText = fullText.toUpperCase();

  // 1. COMELEC Voter Registration Form (CEF-1A) - Check this FIRST because it mentions "Live Birth" and "Marriage" inside it!
  if (upperText.includes("COMMISSION ON ELECTIONS") && upperText.includes("CEF")) {
    return "comelec-cef1";
  }
  
  // 2. COMELEC Transfer / Updating of Data
  if (upperText.includes("SUPPLEMENTARY/UPDATING") || upperText.includes("EXISTING REGISTRATION RECORDS")) {
    return "comelec-supp";
  }

  // 3. PHILHEALTH PMRF
  if (upperText.includes("PHILHEALTH IDENTIFICATION NUMBER") || upperText.includes("PMRF") || upperText.includes("PHILHEALTH WENS")) {
    return "philhealth-pmrf";
  }
  
  // 4. Senior Citizen Form
  if (upperText.includes("NATIONAL COMMISSION OF SENIOR CITIZENS") || upperText.includes("OCTOGENARIAN")) {
    return "ncsc-octo";
  }

  // 5. Birth Certificate (Checked later to avoid false positives from other forms requiring it)
  if (upperText.includes("BIRTH CERTIFICATE") || upperText.includes("LIVE BIRTH")) {
    return "psa-birth";
  }
  
  // 6. Marriage Certificate
  if (upperText.includes("MARRIAGE CERTIFICATE") || upperText.includes("MARCANE CERTIFICATE")) {
    return "psa-marriage";
  }
  
  // 7. Death Certificate
  if (upperText.includes("DEATH CERTIFICATE")) {
    return "psa-death";
  }

  return "UNKNOWN";
};
