const { app, dialog, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const ProgressBar = require("electron-progressbar");
const log = require("electron-log");
const path = require("path");

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
autoUpdater.autoDownload = false;

let mainWindow;
let notifyUser = false; // 알림 활성화 플래그

function sendUpdateStatus(status, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", { status, data });
  }
}

module.exports = (win) => {
  mainWindow = win;
  log.info("Updater module initialized");

  // 앱 시작 시 조용히 업데이트 확인
  autoUpdater.checkForUpdates();

  ipcMain.on("update:check", () => {
    log.info("User requested an update check.");
    notifyUser = true; // 사용자 요청시 알림 활성화
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
      try {
        new Notification({
          title: "HoloAlarm",
          body: "HoloAlarm is up to date.",
          icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
        }).show();
      } catch {}
    }
    notifyUser = false;
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater. " + err);
    sendUpdateStatus("error", err.message);
    if (notifyUser) {
      try {
        new Notification({
          title: "HoloAlarm",
          body: "An error occurred while checking for updates. Please try again later.",
          icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
        }).show();
      } catch {}
    }
    notifyUser = false;
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available.", info);
    sendUpdateStatus("available", info);
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
        title: "HoloAlarm",
        message: `A new version (${info.version}) is available. Download now?`,
        buttons: ["Download", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          log.info("User chose to download. Starting download.");
          autoUpdater.downloadUpdate().catch((err) => {
            log.error("Failed to download update.", err);
            sendUpdateStatus("error", err.message);
            try {
              new Notification({
                title: "HoloAlarm",
                body: "Failed to download the update. Please try again later.",
                icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
              }).show();
            } catch {}
          });
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
      const mainWindowBounds = mainWindow.getBounds();
      const progressBarWidth = 400;
      const progressBarHeight = 200;
      progressBar = new ProgressBar({
        text: "Downloading New HoloAlarm...",
        detail: "Waiting for the HoloAlarm update to start...",
        icon: path.join(__dirname, "..", "..", "img", "icon.ico"),
        browserWindow: {
          parent: mainWindow,
          modal: true,
          resizable: false,
          closable: false,
          minimizable: false,
          maximizable: false,
          width: progressBarWidth,
          height: progressBarHeight,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
          },
        },
      });

      progressBar.on("completed", () => {
        log.info("ProgressBar completed and closed.");
        progressBar = null;

        // 다운로드 완료 후 3초 대기 후 자동 재시작
        log.info("Auto restarting app to apply update in 3 seconds.");
        setTimeout(() => {
          try {
            app.relaunch();
            app.exit(0);
          } catch (e) {
            log.error("Auto restart failed", e);
          }
        }, 3000);
      });

      progressBar.on("aborted", (value) => {
        log.info(`ProgressBar aborted: ${value}`);
        progressBar = null;
      });
    }

    progressBar.value = progressObj.percent;
    progressBar.detail = `Downloading... ${Math.round(progressObj.percent)}%`;
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded", info);
    sendUpdateStatus("downloaded", info);

    // ProgressBar 안전하게 종료
    if (progressBar && !progressBar.isCompleted()) {
      try {
        progressBar.setCompleted();
      } catch (e) {
        log.warn("Failed to complete progressBar:", e);
      }
      progressBar = null;
    } else {
      log.info("No progressBar instance, proceeding with install.");
    }

    // 자동 설치 및 재시작
    log.info("Calling quitAndInstall (isSilent: false, isForceRunAfter: true)");
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (e) {
      log.error("quitAndInstall failed", e);
    }
  });
};
