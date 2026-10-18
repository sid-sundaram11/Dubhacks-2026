import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { DeviceAimTracker, deviceQuaternion } from "../features/starfield/deviceAttitude";
import { SkyController } from "../features/starfield/skyController";

describe("device attitude", () => {
  it("anchors the first reading to the current sky without jumping", () => {
    const sky = new SkyController();
    sky.applyDrag(120, -80);
    const current = sky.getAim().quaternion;
    const device = deviceQuaternion({ alpha: 1.2, beta: 0.4, gamma: -0.6 }, 0, "ios")!;
    const mapped = new DeviceAimTracker().update(device, current);
    expect(new Quaternion(...mapped).angleTo(new Quaternion(...current))).toBeLessThan(1e-7);
  });

  it("moves the camera by the same angle as the phone and preserves zoom", () => {
    const sky = new SkyController();
    sky.applyPinch(1.3);
    const start = sky.getAim();
    const tracker = new DeviceAimTracker();
    tracker.update(new Quaternion(), start.quaternion);
    sky.setAim(tracker.update(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 3), start.quaternion));
    expect(new Quaternion(...start.quaternion).angleTo(new Quaternion(...sky.getAim().quaternion))).toBeCloseTo(Math.PI / 3);
    expect(sky.getAim().fov).toBe(start.fov);
  });

  it("reanchors to a room focus or touch position after being paused", () => {
    const tracker = new DeviceAimTracker();
    tracker.update(new Quaternion(), [0, 0, 0, 1]);
    tracker.reset();
    const target = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1);
    const aim = tracker.update(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.7), [target.x, target.y, target.z, target.w]);
    expect(new Quaternion(...aim).angleTo(target)).toBeLessThan(1e-7);
  });

  it("corrects screen orientation and rejects invalid readings", () => {
    const portrait = deviceQuaternion({ alpha: 0, beta: 0, gamma: 0 }, 0, "android")!;
    const landscape = deviceQuaternion({ alpha: 0, beta: 0, gamma: 0 }, 90, "android")!;
    expect(portrait.angleTo(landscape)).toBeCloseTo(Math.PI / 2);
    expect(deviceQuaternion({ alpha: NaN, beta: 0, gamma: 0 }, 0, "ios")).toBeNull();
  });

  it("handles the native iOS pitch/roll convention and continuous yaw wrap", () => {
    const iosPitch = deviceQuaternion({ alpha: 0, beta: Math.PI / 2, gamma: 0 }, 0, "ios")!;
    const androidRoll = deviceQuaternion({ alpha: 0, beta: 0, gamma: Math.PI / 2 }, 0, "android")!;
    expect(iosPitch.angleTo(androidRoll)).toBeLessThan(1e-7);
    const before = deviceQuaternion({ alpha: Math.PI - 0.01, beta: 0, gamma: 0 }, 0, "ios")!;
    const after = deviceQuaternion({ alpha: -Math.PI + 0.01, beta: 0, gamma: 0 }, 0, "ios")!;
    expect(before.angleTo(after)).toBeCloseTo(0.02);
  });
});
