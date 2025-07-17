const { app, dialog, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const ProgressBar = require("electron-progressbar");
const log = require("electron-log");
const path = require("path");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
autoUpdater.autoDownload = false;
autoUpdater.forceDevUpdateConfig = true;

let mainWindow;
let notifyUser = false; // Flag to control notifications

function sendUpdateStatus(status, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", { status, data });
  }
}

module.exports = (win) => {
  mainWindow = win;
  log.info("Updater module initialized");

  // Check for updates on startup silently
  autoUpdater.checkForUpdates();

  ipcMain.on("update:check", () => {
    log.info("User requested an update check.");
    notifyUser = true; // Enable notifications for this check
    autoUpdater.checkForUpdates();
  });

  let progressBar;

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
    sendUpdateStatus("checking");
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("Update not available.", info);
    sendUpdateStatus("not-available", info);
    if (notifyUser) {
      new Notification({
        title: "No Updates",
        body: "You are currently on the latest version.",
        icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
      }).show();
    }
    notifyUser = false; // Reset flag
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater. " + err);
    sendUpdateStatus("error", err.message);
    if (notifyUser) {
      new Notification({
        title: "Update Error",
        body: "An error occurred while checking for updates. Please try again later.",
        icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
      }).show();
    }
    notifyUser = false; // Reset flag
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available.", info);
    sendUpdateStatus("available", info);
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available. Do you want to download it now?`,
        buttons: ["Download", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          log.info("User chose to download. Starting download.");
          autoUpdater.downloadUpdate();
        } else {
          log.info("User chose to download later.");
          sendUpdateStatus("download-cancelled");
        }
      });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const log_message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    log.info(log_message);
    sendUpdateStatus("downloading", progressObj);

    if (!progressBar) {
      progressBar = new ProgressBar({
        text: "Downloading update...",
        detail: "Waiting for download to start...",
      });
      progressBar.on("completed", () => {
        log.info("ProgressBar completed");
        progressBar.detail = "Download finished. Preparing to install...";
      });
      progressBar.on("aborted", (value) => log.info(`ProgressBar aborted: ${value}`));
    }
    progressBar.value = progressObj.percent;
    progressBar.detail = `Downloading... ${Math.round(progressObj.percent)}%`;
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded", info);
    sendUpdateStatus("downloaded", info);
    if (progressBar) {
      progressBar.setCompleted();
    }
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "A new version has been downloaded. Restart the application to apply the updates.",
        buttons: ["Restart", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          log.info("User chose to restart.");
          autoUpdater.quitAndInstall(false, true);
        } else {
          log.info("User chose to restart later.");
        }
      });
  });
};
