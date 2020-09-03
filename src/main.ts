import * as fs from 'fs'
import * as path from "path";
import { app, BrowserWindow, ipcMain } from "electron";
import { globalShortcut, clipboard, Menu } from "electron";
import { RobotHunt } from "./robot_hunt";
import { shell } from "electron";

const robotHunt = new RobotHunt();
let mainWindow: Electron.BrowserWindow | null;
app.allowRendererProcessReuse = true;

const W = 750;
const H = 650;

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: W,
    height: H,
    minWidth: W,
    minHeight: H,
    maxWidth: W,
    maxHeight: H,
    title: "狩猎大战辅助工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadURL("http://notes.zhuwenbo.cc/hunts-war-ui/build/?" + Date.now());
  // mainWindow.webContents.openDevTools();
  robotHunt.send = function (channel, ...args) {
    mainWindow?.webContents.send(channel, ...args);
  };
  mainWindow.webContents.on("did-finish-load", () => {
    const list: Array<string> = [];
    // 导航完成时触发
    mainWindow?.webContents.send("hunt-init", list);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  // 注册启动/停止快捷键
  globalShortcut.register("F7", () => {
    if (robotHunt.runState) {
      robotHunt.stop();
    } else {
      robotHunt.start();
    }
  });
  // 注册获取坐标快捷键
  globalShortcut.register("F8", () => {
    const location = robotHunt.fetchLocation();
    clipboard.writeText(JSON.stringify(location));
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("hunt-start", (event, options) => {
  robotHunt.start(options)
});
ipcMain.on("hunt-stop", (event) => {
  robotHunt.stop();
});
ipcMain.on("open-url", (event, url) => {
  shell.openExternal(url);
});
const dir = app.getPath('home')
if (!fs.existsSync(path.join(dir, 'screenshots'))) {
  fs.mkdirSync(path.join(dir, 'screenshots'))
}