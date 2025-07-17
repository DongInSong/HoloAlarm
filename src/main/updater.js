const { dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const ProgressBar = require("electron-progressbar");

autoUpdater.autoDownload = false;

module.exports = () => {
  autoUpdater.checkForUpdates();

  let progressBar;

  /* 업데이트가 가능한지 확인하는 부분이다.
업데이트가 가능한 경우 팝업이 뜨면서 업데이트를 하겠냐고 묻는다.
Update를 클릭하면 업데이트 가능한 파일을 다운로드 받는다. */
  autoUpdater.on("update-available", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: "A new version is available. Do you want to update now?",
        buttons: ["Update", "Later"],
      })
      .then((result) => {
        const buttonIndex = result.response;

        if (buttonIndex === 0) autoUpdater.downloadUpdate();
      });
  });

  /* progress bar가 없으면 업데이트를 다운받는 동안 사용자가 그 내용을 알 수 없기 때문에
progress bar는 꼭 만들어준다. */
  autoUpdater.once("download-progress", (progressObj) => {
    progressBar = new ProgressBar({
      text: "Downloading update...",
      detail: "Downloading...",
    });

    progressBar
      .on("completed", function () {
        console.info(`Update completed.`);
        progressBar.detail = "Finishing update...";
      })
      .on("aborted", function () {
        console.info(`Aborting...`);
      });
  });

  // 업데이트를 다운받고 나면 업데이트 설치 후 재시작을 요청하는 팝업이 뜬다.
  autoUpdater.on("update-downloaded", () => {
    progressBar.setCompleted();
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "Update downloaded. Do you want to restart now?",
        buttons: ["Restart", "Later"],
      })
      .then((result) => {
        const buttonIndex = result.response;

        if (buttonIndex === 0) autoUpdater.quitAndInstall(false, true);
      });
  });
};
