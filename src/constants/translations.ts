export type LanguageKey = "English" | "Tagalog" | "Cebuano";
export type TranslationKey =
  | "app_title"
  | "subtitle"
  | "btn_take_photo"
  | "btn_choose_photo"
  | "nav_home"
  | "nav_forms"
  | "nav_settings"
  | "choose_language"
  | "sectionTitle"
  | "label_original_text"
  | "label_definition"
  | "label_example"
  | "label_synonyms"
  | "label_sample_entry"
  | "err_title"
  | "err_offline"
  | "err_timeout"
  | "err_network"
  | "err_rate_limit"
  | "err_blocked"
  | "err_server"
  | "err_invalid"
  | "err_auth"
  | "err_generic"
  | "btn_try_again"
  | "notice_approximate"
  | "btn_explain_sentence"
  | "label_sentence_meaning"
  | "loading_sentence"
  | "notice_ai_generated"
  | "badge_dictionary"
  | "research_title"
  | "research_desc"
  | "research_privacy"
  | "research_export"
  | "research_clear"
  | "research_clear_msg"
  | "research_cancel"
  | "research_helpful"
  | "research_thanks"
  | "research_empty"
  | "form_chip_about"
  | "form_unsure_chip"
  | "form_unsure_hint"
  | "form_picker_title"
  | "form_none"
  | "form_not_this"
  | "form_unavailable"
  | "form_draft"
  | "form_label_purpose"
  | "form_label_who"
  | "form_label_prepare"
  | "form_label_sections"
  | "form_label_submit"
  | "form_label_reminder"
  | "form_last_checked"
  | "research_show_drafts"
  | "how_btn_home"
  | "how_btn_results"
  | "how_title"
  | "how_intro"
  | "how_tab_home"
  | "how_tab_results"
  | "how_close"
  | "how_home_1_title"
  | "how_home_1_body"
  | "how_home_2_title"
  | "how_home_2_body"
  | "how_home_3_title"
  | "how_home_3_body"
  | "how_home_4_title"
  | "how_home_4_body"
  | "how_res_1_title"
  | "how_res_1_body"
  | "how_res_2_title"
  | "how_res_2_body"
  | "how_res_3_title"
  | "how_res_3_body"
  | "how_res_4_title"
  | "how_res_4_body"
  | "how_res_5_title"
  | "how_res_5_body"
  | "how_res_6_title"
  | "how_res_6_body"
  | "how_res_note"
  | "dict_expand"
  | "dict_collapse"
  | "lt_mode_photo"
  | "lt_mode_text"
  | "lt_size"
  | "lt_size_small"
  | "lt_size_medium"
  | "lt_size_large"
  | "lt_hint"
  | "lt_empty"
  | "lt_setting_title"
  | "lt_setting_desc"
  | "offline_banner"
  | "offline_title"
  | "offline_message"
  | "offline_go_history"
  | "offline_try_again"
  | "offline_checking"
  | "offline_still"
  | "offline_scan_blocked";

export const translations: Record<
  LanguageKey,
  Record<TranslationKey, string>
> = {
  English: {
    app_title: "GovForm AI",
    subtitle: "Take a picture of any government form and let AI help you.",
    btn_take_photo: "Take a Picture of the form",
    btn_choose_photo: "Choose Existing Photo",
    nav_home: "Home",
    nav_forms: "Recents",
    nav_settings: "Settings",
    choose_language: "Choose a\nLanguage",
    sectionTitle: "Select a Language",
    label_original_text: "Original Text from Document",
    label_definition: "Definition",
    label_example: "Example Sentence",
    label_synonyms: "Synonyms",
    label_sample_entry: "Sample Entry",
    err_title: "Couldn't Get the Definition",
    err_offline:
      "You're offline and this word isn't saved yet. Connect to the internet and try again.",
    err_timeout:
      "This is taking too long. Check your connection and try again.",
    err_network:
      "Couldn't reach the dictionary service. Check your internet connection and try again.",
    err_rate_limit:
      "The dictionary service is busy right now. Please wait a moment and try again.",
    err_blocked:
      "The AI couldn't provide a definition for this word. Try tapping a different word.",
    err_server:
      "The dictionary service had a problem. Please try again in a moment.",
    err_invalid: "The AI gave an incomplete answer. Please try again.",
    err_auth:
      "The dictionary service isn't set up correctly. Please contact the app developer.",
    err_generic: "Something went wrong. Please try again.",
    btn_try_again: "Try Again",
    notice_approximate:
      "Saved from a different form. It may not match this one.",
    btn_explain_sentence: "Explain this sentence",
    label_sentence_meaning: "Simple version of this sentence",
    loading_sentence: "Simplifying…",
    notice_ai_generated:
      "AI-generated. Check with the agency if you're unsure.",
    badge_dictionary: "From dictionary",
    research_title: "Research mode (for testers)",
    research_desc:
      "Saves how long lookups take, where each answer came from, and your ratings. Everything stays on this phone until you export it.",
    research_privacy:
      "The words you tap are saved too, so don't use real personal forms while this is on.",
    research_export: "Export results (CSV)",
    research_clear: "Clear results",
    research_clear_msg: "Delete all saved research results from this phone?",
    research_cancel: "Cancel",
    research_helpful: "Was this helpful?",
    research_thanks: "Thanks for your feedback!",
    research_empty: "Nothing recorded yet.",
    form_chip_about: "About this form",
    form_unsure_chip: "Which form is this?",
    form_unsure_hint: "This looks like one of these forms.",
    form_picker_title: "Choose the form",
    form_none: "None of these",
    form_not_this: "Not this form?",
    form_unavailable: "Summary not available yet.",
    form_draft: "DRAFT: not verified yet",
    form_label_purpose: "What it is for",
    form_label_who: "Who uses it",
    form_label_prepare: "What to prepare",
    form_label_sections: "What is on the form",
    form_label_submit: "Where to submit",
    form_label_reminder: "Reminder",
    form_last_checked: "Last checked",
    research_show_drafts: "Show draft form summaries",
    how_btn_home: "How to use this app",
    how_btn_results: "Steps: How to use",
    how_title: "How to use GovForm AI",
    how_intro: "Simple steps to scan a form and understand it.",
    how_tab_home: "Before scanning",
    how_tab_results: "After scanning",
    how_close: "Got it",
    how_home_1_title: "Take or choose a photo",
    how_home_1_body:
      "Tap “Take a Picture of the form” to use your camera, or “Choose Existing Photo” to pick an image from your gallery.",
    how_home_2_title: "Make the photo clear",
    how_home_2_body:
      "Put the form on a flat surface with good light. Keep all the text inside the picture and avoid blur and shadows.",
    how_home_3_title: "Wait for the scan",
    how_home_3_body:
      "The app reads the text on the form. This can take a few seconds. Then the words are highlighted on your form.",
    how_home_4_title: "Find your old scans",
    how_home_4_body:
      "Open the “Recents” tab to see forms you scanned before and open them again.",
    how_res_1_title: "Tap a highlighted word",
    how_res_1_body:
      "Every word the app found is highlighted on the form. Tap one to see its meaning, an example sentence and similar words.",
    how_res_2_title: "Get a simpler sentence",
    how_res_2_body:
      "In the word window, tap “Explain this sentence” to get an easier version of the whole sentence.",
    how_res_3_title: "Listen to it",
    how_res_3_body: "Tap the speaker button to hear the meaning read out loud.",
    how_res_4_title: "See what the form is for",
    how_res_4_body:
      "If the app knows the form, tap the blue “About this form” button. It shows what the form is for, who uses it, what to prepare and where to submit it.",
    how_res_5_title: "Not sure which form?",
    how_res_5_body:
      "If you see “Which form is this?”, tap it and choose your form from the list.",
    how_res_6_title: "Zoom in on small text",
    how_res_6_body:
      "On a new scan, pinch with two fingers to zoom in. Drag to move around the form.",
    how_res_note:
      "The “About this form” button only shows for forms the app supports. For any other form you can still tap the highlighted words.",
    dict_expand: "Expand",
    dict_collapse: "Collapse",
    lt_mode_photo: "Photo",
    lt_mode_text: "Large text",
    lt_size: "Text size",
    lt_size_small: "Small",
    lt_size_medium: "Medium",
    lt_size_large: "Large",
    lt_hint: "Tap any word to see what it means.",
    lt_empty: "No words were found in this scan.",
    lt_setting_title: "Open scans in Large text",
    lt_setting_desc:
      "Show the words in big letters first. You can switch back to the photo any time.",
    offline_banner:
      "Offline mode: scanning is turned off. You can still open your saved scans.",
    offline_title: "You're offline",
    offline_message:
      "Scanning needs an internet connection. You can still open the scans you saved before.",
    offline_go_history: "Go to history",
    offline_try_again: "Try again",
    offline_checking: "Checking...",
    offline_still: "Still offline. Please turn on Wi-Fi or mobile data.",
    offline_scan_blocked:
      "Scanning is turned off while you are offline. Connect to the internet to scan a new form.",
  },
  Tagalog: {
    app_title: "GovForm AI",
    subtitle:
      "Kunan ng picture ang anumang form ng gobyerno at hayaang tulungan ka ng AI.",
    btn_take_photo: "Kunan ng Picture ang Form",
    btn_choose_photo: "Pumili sa Gallery",
    nav_home: "Home",
    nav_forms: "Mga Nakaraan",
    nav_settings: "Settings",
    choose_language: "Pumili ng\nWika",
    sectionTitle: "Pumili ng Wika",
    label_original_text: "Orihinal na Teksto mula sa Dokumento",
    label_definition: "Kahulugan ng salita",
    label_example: "Halimbawang Pangungusap",
    label_synonyms: "Mga Kasingkahulugan",
    label_sample_entry: "Halimbawang Isusulat",
    err_title: "Hindi Makuha ang Kahulugan",
    err_offline:
      "Offline ka at hindi pa nase-save ang salitang ito. Kumonekta sa internet at subukan ulit.",
    err_timeout:
      "Masyadong matagal ito. Suriin ang koneksyon mo at subukan ulit.",
    err_network:
      "Hindi maabot ang serbisyo ng diksyunaryo. Suriin ang iyong internet at subukan ulit.",
    err_rate_limit:
      "Abala ang serbisyo ng diksyunaryo ngayon. Maghintay sandali at subukan ulit.",
    err_blocked:
      "Hindi nakapagbigay ng kahulugan ang AI para sa salitang ito. Subukan ang ibang salita.",
    err_server:
      "Nagkaproblema ang serbisyo ng diksyunaryo. Subukan ulit maya-maya.",
    err_invalid: "Hindi kumpleto ang sagot ng AI. Pakisubukan ulit.",
    err_auth:
      "Hindi tama ang setup ng serbisyo ng diksyunaryo. Makipag-ugnayan sa developer ng app.",
    err_generic: "May nangyaring mali. Pakisubukan ulit.",
    btn_try_again: "Subukan Ulit",
    notice_approximate:
      "Na-save mula sa ibang form. Maaaring hindi ito tumugma sa form na ito.",
    btn_explain_sentence: "Ipaliwanag ang pangungusap na ito",
    label_sentence_meaning: "Simpleng bersyon ng pangungusap na ito",
    loading_sentence: "Pinapasimple…",
    notice_ai_generated:
      "Gawa ng AI. Magtanong sa ahensya kung hindi ka sigurado.",
    badge_dictionary: "Mula sa diksyunaryo",
    research_title: "Research mode (para sa mga tester)",
    research_desc:
      "Sine-save ang tagal ng bawat paghahanap, kung saan galing ang sagot, at ang mga rating mo. Mananatili ang lahat sa phone na ito hanggang i-export mo.",
    research_privacy:
      "Isine-save rin ang mga salitang pinindot mo, kaya huwag gumamit ng totoong personal na form habang naka-on ito.",
    research_export: "I-export ang resulta (CSV)",
    research_clear: "Burahin ang resulta",
    research_clear_msg:
      "Burahin ang lahat ng naka-save na research result sa phone na ito?",
    research_cancel: "Kanselahin",
    research_helpful: "Nakatulong ba ito?",
    research_thanks: "Salamat sa feedback mo!",
    research_empty: "Wala pang naitala.",
    form_chip_about: "Tungkol sa form na ito",
    form_unsure_chip: "Anong form ito?",
    form_unsure_hint: "Mukhang isa ito sa mga form na ito.",
    form_picker_title: "Piliin ang form",
    form_none: "Wala sa mga ito",
    form_not_this: "Hindi ito ang form?",
    form_unavailable: "Wala pang summary.",
    form_draft: "DRAFT: hindi pa na-verify",
    form_label_purpose: "Para saan ito",
    form_label_who: "Sino ang gumagamit",
    form_label_prepare: "Ihanda",
    form_label_sections: "Ano ang nasa form",
    form_label_submit: "Saan ibibigay",
    form_label_reminder: "Paalala",
    form_last_checked: "Huling na-check",
    research_show_drafts: "Ipakita ang mga draft na summary ng form",
    how_btn_home: "Paano gamitin ang app",
    how_btn_results: "Mga hakbang",
    how_title: "Paano gamitin ang GovForm AI",
    how_intro: "Mga simpleng hakbang para i-scan ang form at maintindihan ito.",
    how_tab_home: "Bago mag-scan",
    how_tab_results: "Pagkatapos mag-scan",
    how_close: "Sige, naintindihan ko",
    how_home_1_title: "Kumuha o pumili ng larawan",
    how_home_1_body:
      "I-tap ang “Kunan ng Picture ang Form” para gamitin ang camera, o ang “Pumili sa Gallery” para pumili ng larawan sa gallery mo.",
    how_home_2_title: "Gawing malinaw ang larawan",
    how_home_2_body:
      "Ilagay ang form sa patag na lugar na may magandang ilaw. Siguraduhing kasama ang lahat ng teksto sa larawan, at iwasan ang malabo o may anino.",
    how_home_3_title: "Hintayin ang pag-scan",
    how_home_3_body:
      "Babasahin ng app ang teksto sa form. Maaaring abutin ito ng ilang segundo. Pagkatapos, magha-highlight ang mga salita sa form mo.",
    how_home_4_title: "Hanapin ang mga dating scan",
    how_home_4_body:
      "Buksan ang tab na “Mga Nakaraan” para makita ang mga form na na-scan mo na at buksan itong muli.",
    how_res_1_title: "I-tap ang naka-highlight na salita",
    how_res_1_body:
      "Naka-highlight sa form ang bawat salitang nahanap ng app. I-tap ang isa para makita ang kahulugan, halimbawang pangungusap at kahawig na mga salita.",
    how_res_2_title: "Kumuha ng mas simpleng pangungusap",
    how_res_2_body:
      "Sa window ng salita, i-tap ang “Ipaliwanag ang pangungusap na ito” para makuha ang mas madaling bersyon ng buong pangungusap.",
    how_res_3_title: "Pakinggan ito",
    how_res_3_body: "I-tap ang speaker button para marinig ang kahulugan.",
    how_res_4_title: "Alamin kung para saan ang form",
    how_res_4_body:
      "Kung kilala ng app ang form, i-tap ang asul na “Tungkol sa form na ito”. Makikita rito kung para saan ang form, sino ang gumagamit, ano ang ihahanda at saan ito ihahatid.",
    how_res_5_title: "Hindi sigurado kung anong form?",
    how_res_5_body:
      "Kung makita mo ang “Anong form ito?”, i-tap ito at piliin ang form mo sa listahan.",
    how_res_6_title: "I-zoom ang maliliit na teksto",
    how_res_6_body:
      "Sa bagong scan, gamitin ang dalawang daliri para mag-zoom in. I-drag para gumalaw sa form.",
    how_res_note:
      "Lumalabas lang ang “Tungkol sa form na ito” sa mga form na sinusuportahan ng app. Sa ibang form, maaari mo pa ring i-tap ang mga naka-highlight na salita.",
    dict_expand: "Palakihin",
    dict_collapse: "Paliitin",
    lt_mode_photo: "Larawan",
    lt_mode_text: "Malaking letra",
    lt_size: "Laki ng letra",
    lt_size_small: "Maliit",
    lt_size_medium: "Katamtaman",
    lt_size_large: "Malaki",
    lt_hint: "I-tap ang kahit anong salita para malaman ang kahulugan.",
    lt_empty: "Walang nahanap na salita sa scan na ito.",
    lt_setting_title: "Buksan ang mga scan sa Malaking letra",
    lt_setting_desc:
      "Ipakita muna ang mga salita sa malalaking letra. Maaari kang bumalik sa larawan anumang oras.",
    offline_banner:
      "Offline mode: naka-off ang pag-scan. Maaari mo pa ring buksan ang mga na-save mong scan.",
    offline_title: "Offline ka",
    offline_message:
      "Kailangan ng internet para mag-scan. Maaari mo pa ring buksan ang mga scan na na-save mo dati.",
    offline_go_history: "Buksan ang mga nakaraang scan",
    offline_try_again: "Subukan muli",
    offline_checking: "Sinusuri...",
    offline_still: "Offline pa rin. Paki-on ang Wi-Fi o mobile data.",
    offline_scan_blocked:
      "Naka-off ang pag-scan habang offline. Kumonekta sa internet para mag-scan ng bagong form.",
  },
  Cebuano: {
    app_title: "GovForm AI",
    subtitle:
      "Picturi ang bisan unsang form sa gobyerno ug ipatabang kini sa AI.",
    btn_take_photo: "Picturi ang Form",
    btn_choose_photo: "Pangitag Litrato gikan sa Gallery",
    nav_home: "Home",
    nav_forms: "Mga Niagi",
    nav_settings: "Settings",
    choose_language: "Pagpili og\nPinulongan",
    sectionTitle: "Pagpili og Pinulongan",
    label_original_text: "Orihinal nga Teksto gikan sa Dokumento",
    label_definition: "Kahulogan sa pulong",
    label_example: "Pananglitan nga Sentence",
    label_synonyms: "Susama nga mga Pulong",
    label_sample_entry: "Pananglitan nga Isulat",
    err_title: "Wala Makuha ang Kahulogan",
    err_offline:
      "Offline ka ug wala pa ma-save kini nga pulong. Konektar sa internet ug sulayi pag-usab.",
    err_timeout:
      "Dugay kaayo kini. Susiha ang imong koneksyon ug sulayi pag-usab.",
    err_network:
      "Wala maabot ang serbisyo sa diksyonaryo. Susiha ang imong internet ug sulayi pag-usab.",
    err_rate_limit:
      "Busy ang serbisyo sa diksyonaryo karon. Maghulat sa makadiyot ug sulayi pag-usab.",
    err_blocked:
      "Wala makahatag og kahulogan ang AI para niini nga pulong. Sulayi ang lain nga pulong.",
    err_server:
      "Adunay problema ang serbisyo sa diksyonaryo. Sulayi pag-usab sa makadiyot.",
    err_invalid: "Dili kompleto ang tubag sa AI. Palihog sulayi pag-usab.",
    err_auth:
      "Dili husto ang setup sa serbisyo sa diksyonaryo. Kontaka ang developer sa app.",
    err_generic: "Adunay nasayop. Palihog sulayi pag-usab.",
    btn_try_again: "Sulayi Pag-usab",
    notice_approximate:
      "Na-save gikan sa lain nga form. Mahimong dili kini motugma niini nga form.",
    btn_explain_sentence: "Ipasabot kini nga sentence",
    label_sentence_meaning: "Sayon nga bersyon sa kini nga sentence",
    loading_sentence: "Gihimong sayon…",
    notice_ai_generated:
      "Gihimo sa AI. Pangutan-a ang ahensya kung dili ka sigurado.",
    badge_dictionary: "Gikan sa diksyonaryo",
    research_title: "Research mode (para sa mga tester)",
    research_desc:
      "Gi-save ang gidugayon sa matag pagpangita, asa gikan ang tubag, ug imong mga rating. Magpabilin ang tanan sa kini nga phone hangtod i-export nimo.",
    research_privacy:
      "Gi-save usab ang mga pulong nga imong gi-tap, busa ayaw gamita ang tinuod nga personal nga form samtang naka-on kini.",
    research_export: "I-export ang resulta (CSV)",
    research_clear: "Papason ang resulta",
    research_clear_msg:
      "Papason ba ang tanang naka-save nga research result niini nga phone?",
    research_cancel: "Kanselahon",
    research_helpful: "Nakatabang ba kini?",
    research_thanks: "Salamat sa imong feedback!",
    research_empty: "Wala pay natala.",
    form_chip_about: "Mahitungod niini nga form",
    form_unsure_chip: "Unsang form kini?",
    form_unsure_hint: "Morag usa kini niini nga mga form.",
    form_picker_title: "Pilia ang form",
    form_none: "Wala niini",
    form_not_this: "Dili kini nga form?",
    form_unavailable: "Wala pa'y summary.",
    form_draft: "DRAFT: wala pa ma-verify",
    form_label_purpose: "Para saan kini",
    form_label_who: "Kinsa ang mogamit",
    form_label_prepare: "Andama",
    form_label_sections: "Unsa ang naa sa form",
    form_label_submit: "Asa ihatag",
    form_label_reminder: "Paalala",
    form_last_checked: "Katapusang gi-check",
    research_show_drafts: "Ipakita ang mga draft nga summary sa form",
    how_btn_home: "Unsaon paggamit sa app",
    how_btn_results: "Mga lakang",
    how_title: "Unsaon paggamit sa GovForm AI",
    how_intro: "Yanong mga lakang aron i-scan ang form ug masabtan kini.",
    how_tab_home: "Sa dili pa mag-scan",
    how_tab_results: "Human mag-scan",
    how_close: "Sige, nasabtan nako",
    how_home_1_title: "Pagkuha o pagpili og litrato",
    how_home_1_body:
      "I-tap ang “Picturi ang Form” aron gamiton ang camera, o ang “Pangitag Litrato gikan sa Gallery” aron mopili og litrato sa imong gallery.",
    how_home_2_title: "Himoang klaro ang litrato",
    how_home_2_body:
      "Ibutang ang form sa patag nga lugar nga hayag ang suga. Siguroha nga naa ang tanang teksto sa litrato, ug likayi ang labad o landong.",
    how_home_3_title: "Hulata ang pag-scan",
    how_home_3_body:
      "Basahon sa app ang teksto sa form. Mahimong molungtad kini og pipila ka segundo. Dayon, ma-highlight ang mga pulong sa imong form.",
    how_home_4_title: "Pangitaa ang daan nimong mga scan",
    how_home_4_body:
      "Ablihi ang tab nga “Mga Niagi” aron makita ang mga form nga na-scan na nimo ug abli kini pag-usab.",
    how_res_1_title: "I-tap ang naka-highlight nga pulong",
    how_res_1_body:
      "Naka-highlight sa form ang matag pulong nga nakit-an sa app. I-tap ang usa aron makita ang kahulugan, pananglitan nga sentence ug susama nga mga pulong.",
    how_res_2_title: "Pagkuha og mas simple nga sentence",
    how_res_2_body:
      "Sa bintana sa pulong, i-tap ang “Ipasabot kini nga sentence” aron makuha ang mas sayon nga bersyon sa tibuok sentence.",
    how_res_3_title: "Paminawa kini",
    how_res_3_body: "I-tap ang speaker button aron madungog ang kahulugan.",
    how_res_4_title: "Tan-awa kung para saan ang form",
    how_res_4_body:
      "Kung kilala sa app ang form, i-tap ang asul nga “Mahitungod niini nga form”. Makita dinhi kung para saan ang form, kinsa ang mogamit, unsay andamon ug asa kini ihatag.",
    how_res_5_title: "Dili sigurado kung unsang form?",
    how_res_5_body:
      "Kung makita nimo ang “Unsang form kini?”, i-tap kini ug pilia ang imong form sa lista.",
    how_res_6_title: "I-zoom ang gagmay nga teksto",
    how_res_6_body:
      "Sa bag-ong scan, gamita ang duha ka tudlo aron mo-zoom in. I-drag aron mopalayo sa form.",
    how_res_note:
      "Makita lang ang “Mahitungod niini nga form” sa mga form nga gisuportahan sa app. Sa laing form, maka-tap gihapon ka sa mga naka-highlight nga pulong.",
    dict_expand: "Padak-a",
    dict_collapse: "Paliti",
    lt_mode_photo: "Litrato",
    lt_mode_text: "Dako nga letra",
    lt_size: "Gidak-on sa letra",
    lt_size_small: "Gamay",
    lt_size_medium: "Tunga-tunga",
    lt_size_large: "Dako",
    lt_hint: "I-tap ang bisan unsang pulong aron mahibaw-an ang kahulugan.",
    lt_empty: "Walay nakitang pulong sa scan nga kini.",
    lt_setting_title: "Ablihi ang mga scan sa Dako nga letra",
    lt_setting_desc:
      "Ipakita una ang mga pulong sa dagko nga letra. Makabalik ka sa litrato bisan kanus-a.",
    offline_banner:
      "Offline mode: gi-off ang pag-scan. Makaabli ka gihapon sa imong na-save nga mga scan.",
    offline_title: "Offline ka",
    offline_message:
      "Kinahanglan ang internet aron mag-scan. Makaabli ka gihapon sa mga scan nga imong na-save kaniadto.",
    offline_go_history: "Abli ang mga niaging scan",
    offline_try_again: "Sulayi pag-usab",
    offline_checking: "Gisusi...",
    offline_still: "Offline pa gihapon. Palihug i-on ang Wi-Fi o mobile data.",
    offline_scan_blocked:
      "Gi-off ang pag-scan samtang offline. Konekta sa internet aron mag-scan og bag-ong form.",
  },
};
