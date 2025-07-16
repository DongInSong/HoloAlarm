// This application uses the Holodex API.
// For more information, please see the Holodex Public License.
// This service is provided "as is" and without any warranty.
const { HolodexApiClient } = require("holodex.js");
const settingsManager = require("./settingsManager");

let client;

function initClient() {
  const apiKey = settingsManager.getApiKey();
  if (apiKey) {
    client = new HolodexApiClient({ apiKey });
  } else {
    client = null;
  }
}

// Initial initialization
initClient();

function getLiveVideo(org) {
  if (!client) return Promise.resolve([]);
  return client.getLiveVideos({ org: org, status: "live" });
}

function getScheduledVideo(org) {
  if (!client) return Promise.resolve([]);
  return client.getLiveVideos({
    org: org,
    limit: 50,
    status: "upcoming",
    max_upcoming_hours: 24,
  });
}

async function getChannels(org) {
  if (!client) return Promise.resolve([]);
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
    const allChannels = first.concat(second);
    return allChannels.filter(channel => !channel.inactive);
  } catch (error) {
    console.error("Holodex API error in getChannels:", error.message);
    throw error; // Re-throw the error to be caught by the caller
  }
}

module.exports = {
  initClient,
  getLiveVideo,
  getScheduledVideo,
  getChannels,
};
