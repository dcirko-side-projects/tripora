import type { AlertButton } from 'react-native';
type Notice = { title: string; message?: string; buttons: AlertButton[] };
const queue: Notice[] = [];
let listener: (() => void) | undefined;
export const Alert = { alert(title: string, message?: string, buttons?: AlertButton[]) {
  queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'U redu' }] }); listener?.();
} };
export function subscribeAlerts(next: () => void) { listener = next; return () => { listener = undefined; }; }
export function currentAlert() { return queue[0]; }
export function dismissAlert(index: number) {
  const notice = queue.shift(); listener?.(); notice?.buttons[index]?.onPress?.();
}
