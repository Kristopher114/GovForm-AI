import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { LanguageKey, TranslationKey, translations } from '../constants/translations';

interface LocalizationContextType {
  language: LanguageKey;
  setLanguage: (lang: LanguageKey) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageKey>("English");

  useEffect(() => {
    const loadLanguage = async () => {
      const storedLang = await SecureStore.getItemAsync('selectedLanguage');
      if (storedLang && (storedLang === "English" || storedLang === "Tagalog" || storedLang === "Cebuano")) {
        setLanguageState(storedLang as LanguageKey);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: LanguageKey) => {
    await SecureStore.setItemAsync('selectedLanguage', lang);
    setLanguageState(lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
