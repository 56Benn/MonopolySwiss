export type Presence = {
  device: "mobile" | "desktop";
  battery: number | null;
  charging: boolean | null;
  rtt: number | null;
  activity?: "trade" | null;
};
type BatteryInfo = { level: number; charging: boolean; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void };
export const deviceKind = (): Presence["device"] =>
  matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? "mobile" : "desktop";
export function watchDevice(report: (info: Omit<Presence, "rtt">) => void) {
  let battery: BatteryInfo | undefined, stopped = false;
  const send = () => report({ device: deviceKind(), battery: battery ? battery.level : null, charging: battery ? battery.charging : null });
  send();
  const getter = (navigator as Navigator & { getBattery?: () => Promise<BatteryInfo> }).getBattery;
  getter?.call(navigator).then((info) => {
    if (stopped) return;
    battery = info;
    info.addEventListener("levelchange", send);
    info.addEventListener("chargingchange", send);
    send();
  }).catch(() => {});
  return () => {
    stopped = true;
    battery?.removeEventListener("levelchange", send);
    battery?.removeEventListener("chargingchange", send);
  };
}
export const signalBars = (online: boolean, rtt: number | null | undefined) =>
  !online ? 0 : rtt === null || rtt === undefined ? 4 : rtt < 120 ? 4 : rtt < 250 ? 3 : rtt < 500 ? 2 : 1;
export const signalText = ["Getrennt", "Schwach", "Mittel", "Gut", "Sehr gut"];
