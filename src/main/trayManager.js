const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

function createTray(window) {
  const trayIcon = path.join(__dirname, "..", "..", "img", "icon.ico");
  const tray = new Tray(nativeImage.createFromPath(trayIcon));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      type: "normal",
      click() {
        window.show();
      },
    },
    {
      label: "Hide",
      type: "normal",
      click() {
        window.hide();
      },
    },
    { label: "Quit", type: "normal", role: "quit" },
  ]);

  tray.setToolTip("Hololive Alarm");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => (window.isVisible() ? window.hide() : window.show()));

  return tray;
}

module.exports = { createTray };
