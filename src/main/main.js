const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, screen } = require("electron");

let isQuitting = false;

// require("electron-reload")(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`),
// });

const holodexService = require("./holodexService");
const settingsManager = require("./settingsManager");
const trayManager = require("./trayManager");
const imageManager = require("./imageManager");
const path = require("path");
const updater = require("./updater");

let schedule;
let live_period = 1000 * 60 * 1;
let schedule_peried = 1000 * 60 * 2;
let notifiedLiveStreams = new Set();

process.env.NODE_ENV = process.env.NODE_ENV && process.env.NODE_ENV.trim().toLowerCase() == "production" ? "production" : "development";
// process.env.NODE_ENV = "production";
const isDevelopment = process.env.NODE_ENV !== "production";

app.disableHardwareAcceleration();

const packageJson = require("../../package.json");

app.on("ready", async () => {
  app.setAppUserModelId(packageJson.name);
  if (!isDevelopment) {
    launchAtStartIp();
    updater();
  }
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
      y: display.bounds.height - defaultHeight - margin,
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
    icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
  });
  if (isDevelopment) {
    window.webContents.openDevTools();
  }
  window.show();

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  window.on("close", (e) => {
    if (isQuitting) {
      return;
    }

    e.preventDefault();
    const settings = settingsManager.readSetting();

    if (settings.closeAction === "exit") {
      isQuitting = true;
      app.quit();
    } else {
      window.hide();
      const notifyOnTray = settings.notifyOnTray === undefined ? true : settings.notifyOnTray;
      if (notifyOnTray) {
        new Notification({
          title: "HoloAlarm",
          body: "The app continues to run in the tray.",
          icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
        }).show();
      }
    }
  });

  // Save window bounds on resize and move
  window.on("resize", () => {
    const bounds = window.getBounds();
    settingsManager.saveSetting({ windowBounds: bounds });
  });

  window.on("move", () => {
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

  function handleApiError(error, context) {
    console.error(`Failed to load ${context}:`, error.message);
    let errorMessage;
    if (error.code === "ENOTFOUND" || error.message.includes("net::")) {
      errorMessage = `Failed to connect to Holodex. Please check your internet connection.`;
    } else if (error.response && error.response.status === 403) {
      errorMessage = "Invalid API Key. Please check your settings.";
    } else {
      errorMessage = `Failed to load ${context} data. Please try again later.`;
    }
    window.webContents.send("api:error", { message: errorMessage });
  }

  function load_lives() {
    return holodexService.getLiveVideo("Hololive")
      .then(lives => {
        window.webContents.send("live:load", lives);

        const settings = settingsManager.readSetting();
        if (settings.liveNotifications === "none") {
          return;
        }

        lives.forEach((live) => {
          if (live.raw && live.raw.channel && !notifiedLiveStreams.has(live.id)) {
            const isFavorite = settings.favorites.includes(live.raw.channel.id);
            if (settings.liveNotifications === "all" || (settings.liveNotifications === "favorites" && isFavorite)) {
              
              imageManager.downloadAndCacheImage(live.raw.channel.photo, live.raw.channel.id, (iconPath) => {
                const icon = iconPath || path.join(__dirname, "..", "..", "img", "icon.ico");
                new Notification({
                  title: `${live.raw.channel.name} is live!`,
                  body: live.title,
                  icon: icon,
                }).on('click', () => {
                  shell.openExternal(`https://www.youtube.com/watch?v=${live.raw.id}`);
                }).show();
                notifiedLiveStreams.add(live.id);
              });
            }
          }
        });
      })
      .catch(error => {
        handleApiError(error, "live streams");
      });
  }

  async function load_channels() {
    try {
      const channels = await holodexService.getChannels("Hololive");
      window.webContents.send("channel:load", channels);
    } catch (error) {
      handleApiError(error, "channels");
    }
  }

  async function load_schedule() {
    try {
      const schedules = await holodexService.getScheduledVideo("Hololive");
      window.webContents.send("scheduled:load", schedules);
    } catch (error) {
      handleApiError(error, "schedules");
    }
  }
});

app.on("before-quit", (e) => {
  isQuitting = true;
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
