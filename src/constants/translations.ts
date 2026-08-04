export type LanguageKey = "English" | "Tagalog" | "Cebuano";
export type TranslationKey = 
  | "app_title" 
  | "subtitle" 
  | "btn_take_photo" 
  | "btn_choose_photo" 
  | "nav_home" 
  | "nav_forms" 
  | "nav_settings"
  | "choose_language";

export const translations: Record<LanguageKey, Record<TranslationKey, string>> = {
  English: {
    app_title: "GovForm AI",
    subtitle: "Take a picture of any government form and let AI help you.",
    btn_take_photo: "Take a Picture of the form",
    btn_choose_photo: "Choose Existing Photo",
    nav_home: "Home",
    nav_forms: "Forms",
    nav_settings: "Settings",
    choose_language: "Choose a\nLanguage"
  },
  Tagalog: {
    app_title: "GovForm AI",
    subtitle: "Kunan ng picture ang anumang form ng gobyerno at hayaang tulungan ka ng AI.",
    btn_take_photo: "Kunan ng Picture ang Form",
    btn_choose_photo: "Pumili sa Gallery",
    nav_home: "Home",
    nav_forms: "Mga Form",
    nav_settings: "Settings",
    choose_language: "Pumili ng\nWika"
  },
  Cebuano: {
    app_title: "GovForm AI",
    subtitle: "Picturi ang bisan unsang form sa gobyerno ug ipatabang kini sa AI.",
    btn_take_photo: "Picturi ang Form",
    btn_choose_photo: "Pangitag Litrato gikan sa Gallery",
    nav_home: "Home",
    nav_forms: "Mga Form",
    nav_settings: "Settings",
    choose_language: "Pagpili og\nPinulongan"
  }
};
