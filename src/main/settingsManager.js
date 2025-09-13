const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const settingsFilePath = path.join(app.getPath("userData"), "localSetting.json");

function saveSetting(newSettings) {
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
  } catch {
    // File might not exist, that's fine.
  }

  Object.assign(settings, newSettings);

  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

function readSetting() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    if (!settings.favorites) settings.favorites = [];
    if (!settings.apiKey) settings.apiKey = null;
    if (settings.apiKeyVerified === undefined) settings.apiKeyVerified = false;
    if (settings.launchAtStartup === undefined) settings.launchAtStartup = false;
    if (settings.startInTray === undefined) settings.startInTray = true;
    return settings;
  } catch {
    const defaultSetting = {
      favorites: [],
      apiKey: null,
      apiKeyVerified: false,
      theme: "light",
      liveNotifications: "favorites",
      notifyOnTray: true,
      closeAction: "tray",
      launchAtStartup: false,
      startInTray: true,
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSetting, null, 2));
    return defaultSetting;
  }
}

function getApiKey() {
  const settings = readSetting();
  return settings.apiKey;
}


module.exports = {
  saveSetting,
  readSetting,
  getApiKey,
};
