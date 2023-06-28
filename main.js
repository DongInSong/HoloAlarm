const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, screen } = require("electron");

// require("electron-reload")(__dirname, {
//   electron: require(`${__dirname}/node_modules/electron`),
// });

const { HolodexApiClient } = require("holodex.js");
const path = require("path");
const fs = require("fs");
const fn = `${app.getPath("userData")}/localSetting.json`;
const key = "2de44c8d-44c1-40cd-88b1-cf51f7777e95";
const client = new HolodexApiClient({ apiKey: key });
const updater = path.join(__dirname, "updater.js");

let schedule;
let live_period = 1000 * 60 * 1;
let schedule_peried = 1000 * 60 * 10;

process.env.NODE_ENV = process.env.NODE_ENV && process.env.NODE_ENV.trim().toLowerCase() == "production" ? "production" : "development";
// process.env.NODE_ENV = "production";
const isDevelopment = process.env.NODE_ENV !== "production";

app.disableHardwareAcceleration();

app.on("ready", async () => {
  app.setAppUserModelId(app.name);
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
  const display = screen.getPrimaryDisplay();
  const width = display.bounds.width;
  const height = display.bounds.height;
  const window = new BrowserWindow({
    width: 300,
    height: 791,
    x: width,
    y: height - 20,
    show: false,
    autoHideMenuBar: true,
    minimizable: false,
    resizable: isDevelopment ? true : false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "img/channels4_profile.jpg"),
  });

  window.show();

  window.loadFile("index.html");
  window.on("close", (e) => {
    if (window.isVisible()) {
      window.hide();
      e.preventDefault();
    }
  });

  window.webContents.on("did-finish-load", function () {
    load_setting();
    
    if (isDevelopment) {
      load_channels();
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

  const trayIcon = `${__dirname}/img/channels4_profile.jpg`;
  window.tray = new Tray(nativeImage.createFromPath(trayIcon));
  const menu = Menu.buildFromTemplate([
    {
      label: "열기",
      type: "normal",
      click() {
        window.show();
      },
    },
    {
      label: "숨기기",
      type: "normal",
      click() {
        window.hide();
      },
    },
    { label: "종료", type: "normal", role: "quit" },
  ]);

  window.tray.on("click", () => (window.isVisible() ? window.hide() : window.show()));
  window.tray.setToolTip("Hololive Alarm");
  window.tray.setContextMenu(menu);

  ipcMain.on("live_url:send", (event, content) => {
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/watch?v=" + content);
  });

  ipcMain.on("channel_url:send", (event, content) => {
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/channel/" + content);
  });

  ipcMain.on("notification:send", (event, content) => {
    showNotification(content);
  });

  ipcMain.on("setting:save", (event, content) => {
    saveSetting(content);
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
    window.webContents.send("setting:load", readSetting());
  }

  async function load_lives() {
    window.webContents.send("live:load", await getLiveVideo("Hololive"));
  }

  async function load_channels() {
    window.webContents.send("channel:load", await getChannels("Hololive"));
  }

  async function load_schedule() {
    window.webContents.send("scheduled:load", await getScheduledVideo("Hololive"));
  }
});

app.on("before-quit", (e) => {
  window.removeAllListeners("close");
  window = null;
});

function showNotification(data) {
  noti = new Notification({
    title: data["name"],
    body: data["title"],
    icon: nativeImage.createFromDataURL(data["photo"]),
  });
  noti.on("click", (event) => {
    event.preventDefault();
    shell.openExternal("https://www.youtube.com/watch?v=" + data["id"]);
  });

  noti.show();
}

function getLiveVideo(org) {
  return client.getLiveVideos({ org: org, status: "live" });
}

function getScheduledVideo(org) {
  return client.getLiveVideos({
    org: org,
    limit: 50,
    status: "upcoming",
    max_upcoming_hours: 24,
  });
}

async function getChannels(org) {
  try {
    const first = await client.getChannels({
      org: org,
      limit: 50,
      sort: "group",
    });
    const second = await client.getChannels({
      org: org,
      limit: 50,
      offset: 50,
      sort: "group",
    });
    return first.concat(second);
  } catch (error) {
    console.log(error);
  }
}

function saveSetting(content, path = fn) {
  console.log("saving...");
  for (let i in content) {
    var data = readSetting();
    data[i] = content[i];
    fs.writeFileSync(path, JSON.stringify(data));
  }
  console.log(data);
  console.log("saved...");
}

function readSetting() {
  console.log("reading...");
  var setting = {};
  try {
    setting = JSON.parse(fs.readFileSync(fn, "utf8"));
  } catch {
    let defaultSetting = {
      background: "Hakos",
      alarm: "on"
    };
    fs.writeFileSync(fn, JSON.stringify(defaultSetting));
    setting = JSON.parse(fs.readFileSync(fn, "utf8"));
  }
  return setting;
}
