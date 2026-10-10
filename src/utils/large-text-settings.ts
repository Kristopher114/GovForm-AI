// Remembers the person's Large text choices on this phone:
//  - whether new scans should open in Large text (Settings, off by default)
//  - the text size they picked (small / medium / large)
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LargeTextSize = "small" | "medium" | "large";

const OPEN_KEY = "@govform_open_large_text";
const SIZE_KEY = "@govform_large_text_size";

export const getOpenInLargeText = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(OPEN_KEY)) === "1";
  } catch {
    return false;
  }
};

export const setOpenInLargeText = async (value: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(OPEN_KEY, value ? "1" : "0");
  } catch {
    // Not being able to save the choice is not worth interrupting the person.
  }
};

export const getLargeTextSize = async (): Promise<LargeTextSize> => {
  try {
    const value = await AsyncStorage.getItem(SIZE_KEY);
    return value === "small" || value === "large" ? value : "medium";
  } catch {
    return "medium";
  }
};

export const saveLargeTextSize = async (size: LargeTextSize): Promise<void> => {
  try {
    await AsyncStorage.setItem(SIZE_KEY, size);
  } catch {
    // Same as above.
  }
};
