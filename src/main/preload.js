// Import the necessary Electron components.
const contextBridge = require("electron").contextBridge;
const ipcRenderer = require("electron").ipcRenderer;

// White-listed channels.
const ipc = {
  render: {
    // From render to main.
    send: ["setting:save", "notification:send", "live_url:send", "channel_url:send", "reload", "update:check", "data:refresh", "api-key:test"],
    // From main to render.
    receive: ["setting:load", "onair:load", "live:load", "channel:load", "scheduled:load", "api:error", "update:status", "data:refresh-done", "screen:close", "api-key:test-result"],
    // From render to main and back again.
    sendReceive: [],
  },
};

// Exposed protected methods in the render process.
contextBridge.exposeInMainWorld(
  // Allowed 'ipcRenderer' methods.
  "ipcRender",
  {
    // From render to main.
    send: (channel, args) => {
      let validChannels = ipc.render.send;
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, args);
      }
    },
    // From main to render.
    receive: (channel, listener) => {
      let validChannels = ipc.render.receive;
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`.
        ipcRenderer.on(channel, (event, ...args) => listener(...args));
      }
    },
    // From render to main and back again.
    invoke: (channel, args) => {
      let validChannels = ipc.render.sendReceive;
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, args);
      }
    },
  }
);
