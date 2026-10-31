import Svg, { Path, Circle, Rect } from "react-native-svg";
import { tokens } from "./theme";

export type IconName =
  | "trips"
  | "calendar"
  | "pin"
  | "wallet"
  | "more"
  | "back"
  | "next"
  | "plus"
  | "sync"
  | "user"
  | "check"
  | "close"
  | "packing"
  | "photo"
  | "people"
  | "settings"
  | "clock"
  | "download"
  | "alert";
const paths: Record<IconName, string> = {
  trips: "M8 6V4h8v2M4 7h16v13H4zM8 7v13M16 7v13",
  calendar: "M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z",
  wallet: "M4 5h15v15H4zM4 5V3h13M15 10h6v6h-6z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "m14 5-7 7 7 7",
  next: "m9 5 7 7-7 7",
  plus: "M12 5v14M5 12h14",
  sync: "M20 7a9 9 0 0 0-15-2L3 7m0-5v5h5M4 17a9 9 0 0 0 15 2l2-2m0 5v-5h-5",
  user: "M4 21v-2a8 8 0 0 1 16 0v2",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  packing: "M6 7h12v14H6zM9 7V4h6v3M6 12h12",
  photo: "M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5",
  people: "M2 21v-2a6 6 0 0 1 12 0v2M16 14a5 5 0 0 1 6 5v2",
  settings: "m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z",
  clock: "M12 7v5l3 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  alert: "m12 3 10 18H2zM12 9v5M12 17h.01",
};
export function Icon({
  name,
  color = tokens.color.muted,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      <Path d={paths[name]} />
      {name === "pin" ? <Circle cx={12} cy={10} r={2} /> : null}
      {name === "user" ? <Circle cx={12} cy={6} r={4} /> : null}
      {name === "people" ? (
        <>
          <Circle cx={8} cy={7} r={4} />
          <Path d="M16 3a4 4 0 0 1 0 8" />
        </>
      ) : null}
      {name === "clock" ? <Circle cx={12} cy={12} r={9} /> : null}
      {name === "settings" ? <Circle cx={12} cy={12} r={3} /> : null}
      {name === "packing" ? (
        <Rect x={9} y={15} width={6} height={3} rx={1} />
      ) : null}
    </Svg>
  );
}
