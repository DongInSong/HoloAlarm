const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, screen } = require("electron");

// require("electron-reload")(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`),
// });

const holodexService = require("./holodexService");
const settingsManager = require("./settingsManager");
const trayManager = require("./trayManager");
const path = require("path");
const updater = path.join(__dirname, "updater.js");

let schedule;
let live_period = 1000 * 60 * 1;
let schedule_peried = 1000 * 60 * 10;

process.env.NODE_ENV = process.env.NODE_ENV && process.env.NODE_ENV.trim().toLowerCase() == "production" ? "production" : "development";
// process.env.NODE_ENV = "production";
const isDevelopment = process.env.NODE_ENV !== "production";

app.disableHardwareAcceleration();

const packageJson = require("../../package.json");

app.on("ready", async () => {
  app.setAppUserModelId(packageJson.name);
  if (!isDevelopment) launchAtStartIp();
  console.log(isDevelopment);
});

function launchAtStartIp() {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
  });
}

app.once("ready", (e) => {
  const settings = settingsManager.readSetting();
  const display = screen.getPrimaryDisplay();
  
  let windowBounds = settings.windowBounds;
  if (!windowBounds) {
    const defaultWidth = 400;
    const defaultHeight = 700;
    const margin = 50;
    windowBounds = { 
      width: defaultWidth, 
      height: defaultHeight, 
      x: display.bounds.width - defaultWidth - margin, 
      y: display.bounds.height - defaultHeight - margin 
    };
  }

  const window = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 350,
    maxWidth: 500,
    minHeight: 400,
    maxHeight: display.bounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    show: false,
    autoHideMenuBar: true,
    minimizable: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "..", "..", "img", "channels4_profile.jpg"),
  });
  window.webContents.openDevTools();
  window.show();

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  window.on("close", (e) => {
    if (window.isVisible()) {
      window.hide();
      e.preventDefault();
    }
  });

  // Save window bounds on resize and move
  window.on('resize', () => {
    const bounds = window.getBounds();
    settingsManager.saveSetting({ windowBounds: bounds });
  });

  window.on('move', () => {
    const bounds = window.getBounds();
    settingsManager.saveSetting({ windowBounds: bounds });
  });

  window.webContents.on("did-finish-load", function () {
    load_setting();
    
    if (isDevelopment) {
      load_channels()
        .then(() => load_lives())
        .then(() => load_schedule());

      start_update_lives();
      start_update_schedules();
    } else if (!isDevelopment) {
      load_channels()
        .then(() => load_lives())
        .then(() => load_schedule());

      start_update_lives();
      start_update_schedules();
    }
  });

  window.on("hide", (e) => {
    clearTimeout(schedule);
  });

  window.on("show", (e) => {
    load_schedule();
    start_update_schedules();
  });

  window.tray = trayManager.createTray(window);

  ipcMain.on("live_url:send", (event, content) => {
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/watch?v=" + content);
  });

  ipcMain.on("channel_url:send", (event, content) => {
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/channel/" + content);
  });

  // ipcMain.on("notification:send", (event, content) => {
  //   showNotification(content);
  // });

  ipcMain.on("setting:save", (event, content) => {
    settingsManager.saveSetting(content);
    if (content.apiKey) {
      holodexService.initClient();
      // After updating the key, refresh the data.
      load_channels()
        .then(() => load_lives())
        .then(() => load_schedule());
    }
  });

  function start_update_lives() {
    lives = setInterval(() => {
      load_lives();
      console.log("live update");
    }, live_period);
  }

  function start_update_schedules() {
    schedule = setInterval(() => {
      load_schedule();
      console.log("schedule update");
    }, schedule_peried);
  }

  function load_setting() {
    window.webContents.send("setting:load", settingsManager.readSetting());
  }

  async function load_lives() {
    window.webContents.send("live:load", await holodexService.getLiveVideo("Hololive"));
  }

  async function load_channels() {
    try {
      const channels = await holodexService.getChannels("Hololive");
      window.webContents.send("channel:load", channels);
    } catch (error) {
      console.error("Failed to load channels:", error.message);
      if (error.response && error.response.status === 403) {
        window.webContents.send("api:error", { message: "Invalid API Key. Please check your settings." });
      } else {
        window.webContents.send("api:error", { message: "Failed to load data. Please check your connection." });
      }
    }
  }

  async function load_schedule() {
    window.webContents.send("scheduled:load", await holodexService.getScheduledVideo("Hololive"));
  }
});

app.on("before-quit", (e) => {
  window.removeAllListeners("close");
  window = null;
});

// function showNotification(data) {
//   noti = new Notification({
//     title: data["name"],
//     body: data["title"],
//     icon: nativeImage.createFromDataURL(data["photo"]),
//   });
//   noti.on("click", (event) => {
//     event.preventDefault();
//     shell.openExternal("https://www.youtube.com/watch?v=" + data["id"]);
//   });

//   noti.show();
// }
