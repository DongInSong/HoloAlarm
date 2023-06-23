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
        title: "업데이트 확인",
        message: "최신 버전이 등록되었습니다.",
        buttons: ["업데이트", "나중에"],
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
      text: "업데이트 중...",
      detail: "업데이트 중...",
    });

    progressBar
      .on("completed", function () {
        console.info(`업데이트가 완료되었습니다.`);
        progressBar.detail = "업데이트 종료 중...";
      })
      .on("aborted", function () {
        console.info(`취소 중...`);
      });
  });

  // 업데이트를 다운받고 나면 업데이트 설치 후 재시작을 요청하는 팝업이 뜬다.
  autoUpdater.on("update-downloaded", () => {
    progressBar.setCompleted();
    dialog
      .showMessageBox({
        type: "info",
        title: "업데이트 확인",
        message: "재시작하시겠습니까?",
        buttons: ["재시작", "나중에"],
      })
      .then((result) => {
        const buttonIndex = result.response;

        if (buttonIndex === 0) autoUpdater.quitAndInstall(false, true);
      });
  });
};
