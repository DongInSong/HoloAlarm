const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, screen } = require("electron");

let mainWindow;
let isQuitting = false;

// require("electron-reload")(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`),
// });

const holodexService = require("./holodexService");
const settingsManager = require("./settingsManager");
const trayManager = require("./trayManager");
const imageManager = require("./imageManager");
const path = require("path");
const log = require("electron-log");
const updater = require("./updater");

// Configure electron-log for development
log.transports.file.level = false; // Disable file logging
log.transports.console.level = 'info'; // Enable console logging

log.info("App starting...");

// app.commandLine.appendSwitch("high-dpi-support", "true");
// app.commandLine.appendSwitch("force-device-scale-factor", "1");

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, p) => {
  log.error('Unhandled Rejection at:', p, 'reason:', reason);
});

let schedule;
let lives;
let live_period = 1000 * 60 * 1;
let schedule_peried = 1000 * 60 * 2;
let notifiedLiveStreams = new Set();

const isDevelopment = !app.isPackaged;

app.disableHardwareAcceleration();

const packageJson = require("../../package.json");

app.on("ready", async () => {
  log.info("App is ready.");
  // app.setAppUserModelId(packageJson.build.productName);
  app.setAppUserModelId("HoloAlarm");
  // The updater call will be moved to after the window is created.
  if (!isDevelopment) {
    log.info("Setting up launch at start.");
    const settings = settingsManager.readSetting();
    setLaunchAtStartup(settings.launchAtStartup, settings.startInTray);
  }
  log.info(`isDevelopment: ${isDevelopment}`);
});

function setLaunchAtStartup(enabled, startInTray) {
  const settings = {
    openAtLogin: enabled,
    path: app.getPath("exe"),
  };
  if (enabled && startInTray) {
    settings.args = ["--hidden"];
  } else {
    settings.args = [];
  }
  app.setLoginItemSettings(settings);
}

function isWindowVisible(windowBounds) {
  if (!windowBounds) return false;

  return screen.getAllDisplays().some(display => {
    const { x, y, width, height } = display.workArea;
    return (
      windowBounds.x >= x &&
      windowBounds.y >= y &&
      windowBounds.x + windowBounds.width <= x + width &&
      windowBounds.y + windowBounds.height <= y + height
    );
  });
}

app.once("ready", (e) => {
  const settings = settingsManager.readSetting();
  let windowBounds = settings.windowBounds;

  if (!isWindowVisible(windowBounds)) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;
    const defaultWidth = 400;
    const defaultHeight = 700;
    const margin = 20;
    windowBounds = {
      width: defaultWidth,
      height: defaultHeight,
      x: workArea.x + workArea.width - defaultWidth - margin,
      y: workArea.y + workArea.height - defaultHeight - margin,
    };
  }

  const targetDisplay = screen.getDisplayMatching(windowBounds) || screen.getPrimaryDisplay();
  const shouldShowWindow = !process.argv.includes('--hidden');
  const window = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    minWidth: 350,
    maxWidth: 500,
    minHeight: 400,
    maxHeight: targetDisplay.workArea.height,
    x: windowBounds.x,
    y: windowBounds.y,
    show: shouldShowWindow,
    autoHideMenuBar: true,
    minimizable: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
  });
  mainWindow = window;

  // Pass the window object to the updater
  if (!isDevelopment) {
    log.info("Initializing updater.");
    updater(window);
  }

  if (isDevelopment) {
    window.webContents.openDevTools();
  }
  if (shouldShowWindow) {
    window.show();
  }

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  window.on("close", (e) => {
    if (isQuitting) {
      return;
    }
    e.preventDefault();

   const bounds = window.getNormalBounds();
   settingsManager.saveSetting({ windowBounds: bounds });
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

  window.webContents.on("did-finish-load", function () {
    load_setting();
    // Send version info
    window.webContents.send("update:status", { status: "current-version", data: app.getVersion() });

    load_channels()
      .then(() => load_lives())
      .then(() => load_schedule());

    start_update_lives();
    start_update_schedules();
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
    log.info(`Opening channel URL: ${content}`);
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/channel/" + content);
  });

  // ipcMain.on("notification:send", (event, content) => {
  //   showNotification(content);
  // });

  ipcMain.on("setting:save", (event, content) => {
    const oldSettings = settingsManager.readSetting();
    settingsManager.saveSetting(content);

    if ("launchAtStartup" in content || "startInTray" in content) {
      const newSettings = settingsManager.readSetting();
      setLaunchAtStartup(newSettings.launchAtStartup, newSettings.startInTray);
    }

    // If the API key was changed, reload the window from the main process.
    if ("apiKey" in content && content.apiKey !== oldSettings.apiKey) {
      holodexService.initClient();
      // Reload is now triggered from the renderer after user confirmation
      if (mainWindow && !mainWindow.isDestroyed()) {
        // mainWindow.webContents.send("api-key:updated");
        BrowserWindow.fromWebContents(event.sender).reload();
      }
    }
  });

  ipcMain.on('api-key:test', async (event, apiKey) => {
    const result = await holodexService.testApiKey(apiKey);
    if (mainWindow && !mainWindow.isDestroyed()) {
      event.sender.send('api-key:test-result', result);
    }
  });

  ipcMain.on('app:reload', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  ipcMain.on('data:refresh', async () => {
    try {
      // Run all loads in parallel for efficiency
      await Promise.all([
        load_channels(),
        load_lives(),
        load_schedule()
      ]);
    } catch (error) {
      log.error("[Refresh] Error during manual refresh in Promise.all:", error.message);
      // The error is already handled and re-thrown in the individual functions,
      // but we catch it here to prevent unhandled promise rejections.
    } finally {
      // Ensure the loading overlay is always removed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("data:refresh-done");
      }
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
    return holodexService
      .getLiveVideo("Hololive")
      .then((lives) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          window.webContents.send("live:load", lives);
        }

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
                })
                  .on("click", () => {
                    shell.openExternal(`https://www.youtube.com/watch?v=${live.raw.id}`);
                  })
                  .show();
                notifiedLiveStreams.add(live.id);
              });
            }
          }
        });
      })
      .catch((error) => {
        handleApiError(error, "live streams");
        throw error; // Re-throw the error to be caught by Promise.all
      });
  }

  async function load_channels() {
    try {
      const channels = await holodexService.getChannels("Hololive");
      if (mainWindow && !mainWindow.isDestroyed()) {
        window.webContents.send("channel:load", channels);
      }
      // Pre-cache all channel images after loading channels successfully
      channels.forEach(channel => {
        if (channel.raw && channel.raw.photo && channel.raw.id) {
          imageManager.downloadAndCacheImage(channel.raw.photo, channel.raw.id, () => {});
        }
      });
    } catch (error) {
      handleApiError(error, "channels");
      throw error; // Re-throw the error to be caught by Promise.all
    }
  }

  async function load_schedule() {
    try {
      const schedules = await holodexService.getScheduledVideo("Hololive");
      if (mainWindow && !mainWindow.isDestroyed()) {
        window.webContents.send("scheduled:load", schedules);
      }
    } catch (error) {
      handleApiError(error, "schedules");
      throw error; // Re-throw the error to be caught by Promise.all
    }
  }
});

app.on("before-quit", (e) => {
  console.log("Clearing all intervals before quitting.");
  clearInterval(lives);
  clearInterval(schedule);
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
//     body: data["title"],
//     icon: nativeImage.createFromDataURL(data["photo"]),
//   });
//   noti.on("click", (event) => {
//     event.preventDefault();
//     shell.openExternal("https://www.youtube.com/watch?v=" + data["id"]);
//   });

//   noti.show();
// }
