const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

function createTray(window) {
  const trayIcon = path.join(__dirname, "..", "..", "img", "channels4_profile.jpg");
  const tray = new Tray(nativeImage.createFromPath(trayIcon));

  const contextMenu = Menu.buildFromTemplate([
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

  tray.setToolTip("Hololive Alarm");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => (window.isVisible() ? window.hide() : window.show()));

  return tray;
}

module.exports = { createTray };
