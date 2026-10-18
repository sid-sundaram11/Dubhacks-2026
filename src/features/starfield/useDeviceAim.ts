import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { DeviceMotion } from "expo-sensors";
import { DeviceAimTracker, deviceQuaternion } from "./deviceAttitude";
import type { SkyController } from "./skyController";

export function useDeviceAim(
  sky: SkyController,
  enabled: boolean,
  calibration: number,
  onError: (message: string) => void,
) {
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let subscription: ReturnType<typeof DeviceMotion.addListener> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let epoch = 0;
    const tracker = new DeviceAimTracker();
    const stop = () => {
      epoch += 1;
      subscription?.remove();
      subscription = undefined;
      clearTimeout(timeout);
      tracker.reset();
    };
    const start = async () => {
      stop();
      const ownEpoch = epoch;
      try {
        if (!(await DeviceMotion.isAvailableAsync()))
          throw new Error(
            "Motion tracking is unavailable on this device. Touch mode is ready.",
          );
        if (disposed || ownEpoch !== epoch) return;
        const permission = await DeviceMotion.requestPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Motion access is off. Enable it in Settings, or explore by touch.",
          );
        if (disposed || ownEpoch !== epoch) return;
        DeviceMotion.setUpdateInterval(32);
        timeout = setTimeout(() => {
          if (!disposed) {
            stop();
            errorRef.current(
              "No motion readings received. Touch mode is ready.",
            );
          }
        }, 5000);
        subscription = DeviceMotion.addListener((reading) => {
          if (!reading.rotation) return;
          const device = deviceQuaternion(
            reading.rotation,
            reading.orientation,
            Platform.OS,
          );
          if (!device) return;
          clearTimeout(timeout);
          sky.setAim(tracker.update(device, sky.getAim().quaternion));
        });
      } catch (error) {
        if (!disposed && ownEpoch === epoch) {
          stop();
          errorRef.current(
            error instanceof Error
              ? error.message
              : "Motion tracking could not start. Touch mode is ready.",
          );
        }
      }
    };
    if (AppState.currentState === "active") void start();
    const lifecycle = AppState.addEventListener("change", (state) => {
      if (state === "active") void start();
      else stop();
    });
    return () => {
      disposed = true;
      stop();
      lifecycle.remove();
    };
  }, [sky, enabled, calibration]);
}
