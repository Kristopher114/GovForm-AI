// Is the phone online? Used to turn scanning off while offline.
//
// "Offline" means the phone is not connected to any network, or it is
// connected (for example to Wi-Fi) but Android says the internet cannot be
// reached. If Android has not worked it out yet, we treat the phone as online
// so nobody is blocked by mistake.
import * as Network from "expo-network";

interface NetworkLike {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

export const isOfflineState = (state: NetworkLike): boolean =>
  state.isConnected === false || state.isInternetReachable === false;

// One-time check (for example just before a scan starts).
export const checkIsOffline = async (): Promise<boolean> => {
  try {
    return isOfflineState(await Network.getNetworkStateAsync());
  } catch {
    return false;
  }
};

// Live value for screens: updates by itself when the connection changes.
export const useIsOffline = (): boolean => {
  const state = Network.useNetworkState();
  return isOfflineState(state);
};
