import { ipcRenderer } from "electron";

window.NativeNotice = {
  on: function (channel: string, callback: (...args: any[]) => void) {
    ipcRenderer.on(channel, (event, ...args) => {
      callback && callback(...args);
    });
  },
  send: function (channel: string, ...args: any[]) {
    ipcRenderer.send(channel, ...args);
  },
};

declare global {
  interface Window {
    NativeNotice: INativeNotice;
  }
}
type INativeNotice = {
  on: (channel: string, callback: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
};