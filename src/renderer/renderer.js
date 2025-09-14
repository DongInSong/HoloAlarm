let favorites = [];
let allChannels = [];
let activeTimers = [];
let liveVideos = [];
let scheduledVideos = [];
let timerIntervalId = null;
let currentSettings = {};
let apiKeyTestTimeout = null;

const settingsBtn = document.getElementById("settings-btn");
const actionBtn = document.getElementById("action-btn");
const refreshBtn = document.getElementById("refresh-btn");
const loadingOverlay = document.getElementById("loading-overlay");
const settingsModal = document.getElementById("settings-modal");
const closeBtn = settingsModal.querySelector(".close");
const apiKeyInput = document.getElementById("api-key-input");
const toggleApiKeyVisibilityBtn = document.getElementById("toggle-api-key-visibility-btn");
const apiKeyStatusMessage = document.getElementById("api-key-status-message");
const saveApiKeyBtn = document.getElementById("save-api-key");
const themeSwitch = document.getElementById("theme-switch");
const closeActionSelect = document.getElementById("close-action-select");
const notifyOnTraySwitch = document.getElementById("notify-on-tray-switch");
const launchAtStartupSwitch = document.getElementById("launch-at-startup-switch");
const startupOptions = document.getElementById("startup-options");
const startInTrayRadio = document.getElementById("start-in-tray-radio");
const showWindowRadio = document.getElementById("show-window-radio");
const liveNotificationSelect = document.getElementById("live-notification-select");
const currentVersionSpan = document.getElementById("current-version");
const checkForUpdateBtn = document.getElementById("check-for-update-btn");
// const updateStatusP = document.getElementById('update-status'); // No longer needed

// --- Event Listeners ---
toggleApiKeyVisibilityBtn.addEventListener("click", () => {
  const icon = toggleApiKeyVisibilityBtn.querySelector("i");
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    apiKeyInput.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
});

refreshBtn.addEventListener("click", () => {
  if (refreshBtn.classList.contains("disabled")) return;
  window.ipcRender.send("data:refresh");
  loadingOverlay.style.display = "flex";
  refreshBtn.classList.add("disabled");
});

actionBtn.addEventListener("click", () => {
  const currentState = actionBtn.getAttribute("states");

  if (currentState === "scrollUp") {
    scrollUp();
  } else if (currentState === "close") {
    document.querySelectorAll("details").forEach((detail) => {
      detail.removeAttribute("open");
    });
  } else if (currentState === "openAll") {
    document.querySelectorAll("details:not(.disabled-details)").forEach((detail) => {
      detail.setAttribute("open", true);
    });
  }
  // After action, immediately update the button state
  updateActionBtnState();
});

checkForUpdateBtn.addEventListener("click", (event) => {
  event.preventDefault(); // Prevent default link behavior
  if (checkForUpdateBtn.classList.contains("disabled")) return;
  // updateStatusP.innerText = ''; // No longer needed
  window.ipcRender.send("update:check");
});

settingsBtn.addEventListener("click", () => {
  // Reset API key field based on saved verification status
  setupApiKeyField(currentSettings.apiKeyVerified);

  // Store current settings when modal opens
  currentSettings = {
    apiKey: apiKeyInput.value,
    apiKeyVerified: currentSettings.apiKeyVerified,
    theme: themeSwitch.checked,
    closeAction: closeActionSelect.value,
    notifyOnTray: notifyOnTraySwitch.checked,
    liveNotifications: liveNotificationSelect.value,
    launchAtStartup: launchAtStartupSwitch.checked,
    startInTray: startInTrayRadio.checked,
  };

  // Remove error styles when opening the modal
  apiKeyInput.classList.remove("input-error");
  apiKeyInput.classList.remove("shake");
  settingsModal.showModal();
});

function restoreSettings() {
  apiKeyInput.value = currentSettings.apiKey;
  themeSwitch.checked = currentSettings.theme;
  document.documentElement.setAttribute("data-theme", currentSettings.theme ? "dark" : "light");
  closeActionSelect.value = currentSettings.closeAction;
  notifyOnTraySwitch.checked = currentSettings.notifyOnTray;
  liveNotificationSelect.value = currentSettings.liveNotifications;
  launchAtStartupSwitch.checked = currentSettings.launchAtStartup;
  startupOptions.disabled = !currentSettings.launchAtStartup;
  startInTrayRadio.checked = currentSettings.startInTray;
  showWindowRadio.checked = !currentSettings.startInTray;
}

closeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  restoreSettings();
  settingsModal.close();
});

// Also handle closing via the ESC key or clicking the backdrop
settingsModal.addEventListener("close", () => {
  clearTimeout(apiKeyTestTimeout); // Cancel any pending test
  if (settingsModal.open) {
    restoreSettings();
  }
});

saveApiKeyBtn.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    apiKeyInput.classList.add("input-error");
    apiKeyInput.scrollIntoView({ behavior: "smooth", block: "center" });

    apiKeyInput.classList.add("shake");
    apiKeyInput.addEventListener(
      "animationend",
      () => {
        apiKeyInput.classList.remove("shake");
      },
      { once: true }
    );

    return; // Stop if API key is missing
  }

  const settingsToSave = {
    apiKey: apiKeyInput.value.trim(),
    apiKeyVerified: true, // Mark as verified
    theme: themeSwitch.checked ? "dark" : "light",
    closeAction: closeActionSelect.value,
    notifyOnTray: notifyOnTraySwitch.checked,
    liveNotifications: liveNotificationSelect.value,
    launchAtStartup: launchAtStartupSwitch.checked,
    startInTray: startInTrayRadio.checked,
  };

  window.ipcRender.send("setting:save", settingsToSave);
  settingsModal.close();
});

apiKeyInput.addEventListener("input", () => {
  saveApiKeyBtn.disabled = true;
  apiKeyStatusMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Waiting for you to finish typing...';
  apiKeyStatusMessage.classList.remove("status-success", "status-error");

  // Debounce the API key test
  clearTimeout(apiKeyTestTimeout);
  apiKeyTestTimeout = setTimeout(() => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      apiKeyStatusMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
      window.ipcRender.send("api-key:test", apiKey);
    } else {
      apiKeyStatusMessage.innerHTML = `<i class="fas fa-times-circle"></i> API key cannot be empty.`;
      apiKeyStatusMessage.classList.add("status-error");
    }
  }, 1000); // Wait 1 second after user stops typing

  if (apiKeyInput.value.trim()) {
    apiKeyInput.classList.remove("input-error");
  }
});

themeSwitch.addEventListener("change", () => {
  const theme = themeSwitch.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
});

launchAtStartupSwitch.addEventListener("change", () => {
  startupOptions.disabled = !launchAtStartupSwitch.checked;
});

function areAllDetailsClosed() {
  // disabled details are not considered for this logic
  const details = document.querySelectorAll("details:not(.disabled-details)");
  return ![...details].some(d => d.hasAttribute("open"));
}

function updateActionBtnState() {
  const icon = actionBtn.querySelector("i");
  const isScrolled = document.documentElement.scrollTop || document.body.scrollTop > 20;

  if (isScrolled) {
    actionBtn.setAttribute("states", "scrollUp");
    icon.className = "fas fa-arrow-up";
    icon.style.transform = "";
    icon.style.fontSize = "16px";
  } else {
    if (areAllDetailsClosed()) {
      actionBtn.setAttribute("states", "openAll");
      icon.className = "fa-solid fa-caret-up";
      icon.style.transform = "rotate(90deg)";
      icon.style.fontSize = "24px"; 
    } else {
      actionBtn.setAttribute("states", "close");
      icon.className = "fas fa-compress-arrows-alt";
      icon.style.transform = "";
      icon.style.fontSize = "16px";
    }
  }
}

window.onscroll = updateActionBtnState;

// --- IPC Renderers ---
window.ipcRender.receive("setting:load", (data) => {
  // Store initial settings
  currentSettings = {
    apiKey: data.apiKey || "",
    apiKeyVerified: data.apiKeyVerified || false,
    theme: data.theme === "dark",
    closeAction: data.closeAction || "tray",
    notifyOnTray: data.notifyOnTray === undefined ? true : data.notifyOnTray,
    liveNotifications: data.liveNotifications || "all",
    launchAtStartup: data.launchAtStartup === undefined ? false : data.launchAtStartup,
    startInTray: data.startInTray === undefined ? true : data.startInTray,
  };

  apiKeyInput.value = data.apiKey || "";
  if (!data.apiKey) {
    settingsModal.showModal();
  }

  const currentTheme = data.theme || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  themeSwitch.checked = currentTheme === "dark";

  const closeAction = data.closeAction || "tray";
  closeActionSelect.value = closeAction;

  const notifyOnTray = data.notifyOnTray === undefined ? true : data.notifyOnTray;
  notifyOnTraySwitch.checked = notifyOnTray;

  const launchAtStartup = data.launchAtStartup === undefined ? false : data.launchAtStartup;
  launchAtStartupSwitch.checked = launchAtStartup;
  startupOptions.disabled = !launchAtStartup;

  const startInTray = data.startInTray === undefined ? true : data.startInTray;
  startInTrayRadio.checked = startInTray;
  showWindowRadio.checked = !startInTray;

  const liveNotifications = data.liveNotifications || "all";
  liveNotificationSelect.value = liveNotifications;

  favorites = data.favorites || [];
});

window.ipcRender.receive("update:status", ({ status, data }) => {
  console.log("Update status received:", status, data);
  const updateIcon = checkForUpdateBtn.querySelector("i");

  checkForUpdateBtn.classList.remove("disabled");
  if (updateIcon) updateIcon.classList.remove("fa-spin");

  switch (status) {
    case "checking":
      checkForUpdateBtn.classList.add("disabled");
      updateIcon.classList.add("fa-spin");
      break;
    case "current-version":
      currentVersionSpan.innerText = data;
      break;
  }
});

window.ipcRender.receive("channel:load", (data) => {
  const mainContainer = document.getElementById("main");
  const existingError = document.getElementById("api-error-message");
  if (existingError) existingError.remove();

  allChannels = data;

  const detailsToRemove = mainContainer.querySelectorAll("details:not(#live-details):not(#favorites-details)");
  detailsToRemove.forEach((d) => d.remove());

  const channelsByGroup = data.reduce((acc, channel) => {
    const group = channel.raw.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(channel);
    return acc;
  }, {});

  for (const groupName in channelsByGroup) {
    if (groupName === "undefined") continue;
    createChannelGroup(groupName, channelsByGroup[groupName]);
  }
  updateFavoritesSection();
  initSortable();
});

window.ipcRender.receive("api-key:test-result", ({ success, message }) => {
  apiKeyStatusMessage.classList.remove("status-success", "status-error");
  if (success) {
    apiKeyStatusMessage.innerHTML = `<i class="fas fa-check-circle"></i> API Key is valid!`;
    apiKeyStatusMessage.classList.add("status-success");
    saveApiKeyBtn.disabled = false;
    currentSettings.apiKeyVerified = true;
  } else {
    apiKeyStatusMessage.innerHTML = `<i class="fas fa-times-circle"></i> ${message}`;
    apiKeyStatusMessage.classList.add("status-error");
    saveApiKeyBtn.disabled = true;
    currentSettings.apiKeyVerified = false;
  }
});

window.ipcRender.receive("api-key:updated", () => {
  // alert("API key has been updated. The app will now refresh.");
  window.ipcRender.send("app:reload");
});

window.ipcRender.receive("data:refresh-done", () => {
  loadingOverlay.style.display = "none";
  refreshBtn.classList.remove("disabled");
});

window.ipcRender.receive("api:error", (error) => {
  const mainContainer = document.getElementById("main");

  const liveContainer = document.getElementById("live");
  if (liveContainer) liveContainer.innerHTML = "";

  const favoritesContainer = document.getElementById("favorites");
  if (favoritesContainer) favoritesContainer.innerHTML = "";

  if (mainContainer) {
    const detailsToRemove = mainContainer.querySelectorAll("details:not(#live-details):not(#favorites-details)");
    detailsToRemove.forEach((d) => d.remove());
  }

  const liveDetails = document.getElementById("live-details");
  if (liveDetails) {
    liveDetails.removeAttribute("open");
    liveDetails.classList.add("disabled-details");
  }
  const favoritesDetails = document.getElementById("favorites-details");
  if (favoritesDetails) {
    favoritesDetails.removeAttribute("open");
    favoritesDetails.classList.add("disabled-details");
  }

  const existingError = document.getElementById("api-error-message");
  if (existingError) existingError.remove();

  const errorDiv = document.createElement("div");
  errorDiv.id = "api-error-message";
  errorDiv.innerHTML = `<h2>API Error</h2><p>${error.message}</p><p>Please open settings (⚙️) and enter a valid API key.</p>`;
  mainContainer.appendChild(errorDiv);
});

window.ipcRender.receive("live:load", (newLiveVideos) => {
  liveVideos = newLiveVideos;
  const liveDetails = document.getElementById("live-details");
  const liveContainer = document.getElementById("live");

  const currentlyLiveIds = newLiveVideos.map((v) => v.raw.channel.id);
  const previousLiveIds = activeTimers.map((t) => t.channelId);

  const endedStreamIds = previousLiveIds.filter((id) => !currentlyLiveIds.includes(id));
  endedStreamIds.forEach((channelId) => {
    const articleToRemove = document.getElementById(`live_section_card_${channelId}`);
    if (articleToRemove) liveContainer.removeChild(articleToRemove);

    updateCardLiveStatus(channelId, null);
  });

  activeTimers = activeTimers.filter((timer) => currentlyLiveIds.includes(timer.channelId));

  newLiveVideos.forEach((video) => {
    const channelId = video.raw.channel.id;
    let timer = activeTimers.find((t) => t.channelId === channelId);

    if (!timer) {
      timer = {
        channelId: channelId,
        startTime: new Date(video.raw.start_actual),
        elements: [],
      };
      activeTimers.push(timer);
      createLiveCard(video, timer);
    } else {
      if (isNaN(timer.startTime.getTime()) && video.raw.start_actual) {
        timer.startTime = new Date(video.raw.start_actual);
      }
      const liveVideo = liveVideos.find((v) => v.id === video.id);
      if (liveVideo) {
        Object.assign(liveVideo.raw, video.raw);
      }
      updateCardLiveStatus(channelId, video, timer);

      const liveSectionCard = document.getElementById(`live_section_card_${channelId}`);
      if (liveSectionCard) {
        const liveInfoContainer = liveSectionCard.querySelector(".live-info-content");
        if (liveInfoContainer) {
          const viewerElement = liveInfoContainer.querySelector(".viewer-count");
          if (viewerElement && video.raw.live_viewers) {
            viewerElement.innerHTML = `<i class="fas fa-eye" style="color: var(--holo-blue);"></i>   ${video.raw.live_viewers.toLocaleString(
              "en-US"
            )} watching     `;
          }
        }
      }
    }
  });

  if (activeTimers.length > 0 && !timerIntervalId) {
    updateAllTimers();
    timerIntervalId = setInterval(updateAllTimers, 1000);
  } else if (activeTimers.length === 0 && timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }

  if (liveContainer.children.length === 0) {
    liveDetails.classList.add("disabled-details");
  } else {
    liveDetails.classList.remove("disabled-details");
  }
  updateLiveFavorites();
});

window.ipcRender.receive("scheduled:load", (newScheduledVideos) => {
  scheduledVideos = newScheduledVideos;
  const allScheduledInfo = document.querySelectorAll("[id^='scheduled_info_']");
  allScheduledInfo.forEach((info) => {
    info.innerHTML = "";
    info.style.display = "none";
  });

  newScheduledVideos.forEach((video) => {
    const channelId = video.raw.channel.id;
    updateCardScheduleStatus(channelId, video);
  });
});

// --- UI Creation Functions ---
function createChannelGroup(groupName, channels) {
  const mainContainer = document.getElementById("main");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.className = "gen";
  summary.textContent = groupName;

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "items";
  itemsContainer.id = groupName.replace(/\s/g, "");

  channels.forEach((channel) => {
    const article = createBaseCard(channel);
    itemsContainer.appendChild(article);
  });

  details.appendChild(summary);
  details.appendChild(itemsContainer);
  mainContainer.appendChild(details);
}

function createBaseCard(channel) {
  const article = document.createElement("article");
  article.classList.add("artile");
  const uniqueId = channel.raw.id;
  article.id = `profile_article_${uniqueId}`;
  article.dataset.channelId = uniqueId;
  article.style.setProperty("--bg-image", `url(${channel.raw.photo})`);
  if (channel.raw.banner) article.dataset.bannerUrl = channel.raw.banner;

  const photo = document.createElement("img");
  photo.className = "photo";
  photo.src = channel.raw.photo;
  photo.draggable = false;
  photo.style.cursor = "pointer";

  photo.onerror = () => {
    article.remove();
  };

  const infoContainer = document.createElement("div");
  infoContainer.className = "info-container";

  const nameContainer = document.createElement("div");
  nameContainer.style.display = "flex";
  nameContainer.style.alignItems = "center";

  const eng_name = document.createElement("header");
  eng_name.className = "eng_name";
  eng_name.innerText = channel.raw.english_name;
  eng_name.style.cursor = "pointer";

  const favoriteBtn = document.createElement("i");
  favoriteBtn.className = `favorite-btn ${favorites.includes(uniqueId) ? "fas" : "far"} fa-star`;
  favoriteBtn.style.cursor = "pointer";
  favoriteBtn.style.marginLeft = "0.5rem";

  nameContainer.appendChild(eng_name);
  nameContainer.appendChild(favoriteBtn);

  infoContainer.appendChild(nameContainer);

  const live_info = document.createElement("footer");
  live_info.id = `live_info_${uniqueId}`;
  live_info.style.display = "none";

  const scheduled_info = document.createElement("footer");
  scheduled_info.id = `scheduled_info_${uniqueId}`;
  scheduled_info.style.display = "none";

  infoContainer.appendChild(nameContainer);
  infoContainer.appendChild(live_info);
  infoContainer.appendChild(scheduled_info);

  article.appendChild(photo);
  article.appendChild(infoContainer);
  return article;
}

function createLiveCard(video, timer) {
  const liveContainer = document.getElementById("live");
  const channelId = video.raw.channel.id;
  const channel = allChannels.find((c) => c.raw.id === channelId);

  if (channel) {
    const liveCard = createBaseCard(channel);
    liveCard.id = `live_section_card_${channelId}`;

    const infoContainer = liveCard.querySelector(".info-container");

    const liveInfoPlaceholder = infoContainer.querySelector(`[id^='live_info_']`);
    if (liveInfoPlaceholder) liveInfoPlaceholder.remove();
    const scheduledInfoPlaceholder = infoContainer.querySelector(`[id^='scheduled_info_']`);
    if (scheduledInfoPlaceholder) scheduledInfoPlaceholder.remove();

    const liveDiv = createLiveDiv(video, timer);
    infoContainer.appendChild(liveDiv);

    liveContainer.insertBefore(liveCard, liveContainer.firstChild);

    updateCardLiveStatus(channelId, video, timer);
  }
}

function createScheduleCard(video) {
  const scheduledDiv = document.createElement("article");
  scheduledDiv.className = "schedule-item";
  if (video.raw.topic_id === "membersonly") scheduledDiv.setAttribute("data-theme", "light");

  const title = document.createElement("span");
  title.innerText = video.raw.title;

  const schedule = scheduletime(video.raw.start_scheduled);
  const topicDiv = topic(video.raw.topic_id);

  scheduledDiv.appendChild(title);
  scheduledDiv.appendChild(schedule);
  scheduledDiv.appendChild(topicDiv);
  scheduledDiv.style.cursor = "pointer";

  return scheduledDiv;
}

function createLiveDiv(video, timer) {
  const liveDiv = document.createElement("div");
  liveDiv.className = "live-info-content";
  liveDiv.dataset.videoId = video.raw.id; // Store video ID directly on the element
  if (video.raw.topic_id === "membersonly") liveDiv.setAttribute("data-theme", "light");

  const title = document.createElement("span");
  title.innerText = video.raw.title;

  const uptime = document.createElement("div");
  uptime.className = "uptime-timer";
  if (timer) timer.elements.push(uptime);

  const viewer = document.createElement("small");
  viewer.className = "viewer-count";
  if (video.raw.topic_id !== "membersonly" && video.raw.live_viewers) {
    viewer.innerHTML = `<i class="fas fa-eye" style="color: var(--holo-blue);"></i>   ${video.raw.live_viewers.toLocaleString(
      "en-US"
    )} watching     `;
  }

  const topicDiv = topic(video.raw.topic_id);

  const viewerTopicContainer = document.createElement("div");
  viewerTopicContainer.className = "viewer-topic-container";

  viewerTopicContainer.appendChild(viewer);
  viewerTopicContainer.appendChild(topicDiv);

  liveDiv.appendChild(title);
  liveDiv.appendChild(uptime);
  liveDiv.appendChild(viewerTopicContainer);
  liveDiv.style.cursor = "pointer";

  return liveDiv;
}

// --- Timer & Update Functions ---
function updateAllTimers() {
  activeTimers.forEach((timer) => {
    const now = new Date();
    let timeString;

    if (timer.startTime && !isNaN(timer.startTime.getTime())) {
      const uptime = new Date(now - timer.startTime);
      timeString = `<i class="fas fa-signal" style="color: var(--holo-blue); margin-right: 4px;"></i><span class="uptime-timer-text">    ${String(
        uptime.getUTCHours()
      ).padStart(2, "0")}:${String(uptime.getUTCMinutes()).padStart(2, "0")}:${String(uptime.getUTCSeconds()).padStart(2, "0")}</span>`;
    } else {
      timeString = `<i class="fas fa-spinner fa-spin" style="color: var(--holo-blue); margin-right: 4px;"></i><span style="color: var(--text-secondary);">Waiting...</span>`;
    }

    timer.elements.forEach((element) => {
      if (element) element.innerHTML = timeString;
    });
  });
}

function toggleFavorite(channelId) {
  const favoritesContainer = document.getElementById("favorites");
  const favoritesDetails = favoritesContainer.closest("details");
  const index = favorites.indexOf(channelId);

  if (index > -1) {
    favorites.splice(index, 1);
    const cardToRemove = favoritesContainer.querySelector(`#profile_article_${channelId}`);
    if (cardToRemove) {
      cardToRemove.remove();
    }
  } else {
    favorites.push(channelId);
    const channel = allChannels.find((c) => c.raw.id === channelId);
    if (channel) {
      const favoriteCard = createBaseCard(channel);
      const liveVideo = liveVideos.find((v) => v.raw.channel.id === channelId);
      const timer = activeTimers.find((t) => t.channelId === channelId);
      if (liveVideo && timer) {
        const liveInfoContainer = favoriteCard.querySelector(`[id^='live_info_']`);
        if (liveInfoContainer) {
          liveInfoContainer.innerHTML = "";
          const liveDiv = createLiveDiv(liveVideo, timer);
          liveInfoContainer.appendChild(liveDiv);
          liveInfoContainer.style.display = "block";
        }
      } else {
        const scheduledVideo = scheduledVideos.find((v) => v.raw.channel.id === channelId);
        if (scheduledVideo) {
          const scheduleInfoContainer = favoriteCard.querySelector(`[id^='scheduled_info_']`);
          if (scheduleInfoContainer) {
            scheduleInfoContainer.innerHTML = "";
            const scheduleCard = createScheduleCard(scheduledVideo);
            scheduleInfoContainer.appendChild(scheduleCard);
            scheduleInfoContainer.style.display = "block";
          }
        }
      }
      favoritesContainer.appendChild(favoriteCard);
    }
  }

  window.ipcRender.send("setting:save", { favorites: favorites });
  updateFavoriteStar(channelId);

  if (favoritesContainer.children.length === 0) {
    favoritesDetails.classList.add("disabled-details");
    favoritesDetails.open = false;
  } else {
    favoritesDetails.classList.remove("disabled-details");
  }
}

function updateFavoriteStar(channelId) {
  document
    .querySelectorAll(
      `#profile_article_${channelId} .favorite-btn, #favorites #profile_article_${channelId} .favorite-btn, #live #live_section_card_${channelId} .favorite-btn`
    )
    .forEach((starIcon) => {
      starIcon.classList.toggle("fas", favorites.includes(channelId));
      starIcon.classList.toggle("far", !favorites.includes(channelId));
    });
}

function updateFavoritesSection() {
  const favoritesContainer = document.getElementById("favorites");
  const favoritesDetails = favoritesContainer.closest("details");
  if (!favoritesContainer) return;
  favoritesContainer.innerHTML = "";

  const favoriteChannels = allChannels
    .filter((c) => favorites.includes(c.raw.id))
    .sort((a, b) => favorites.indexOf(a.raw.id) - favorites.indexOf(b.raw.id));

  favoriteChannels.forEach((channel) => {
    const favoriteCard = createBaseCard(channel);

    const liveVideo = liveVideos.find((v) => v.raw.channel.id === channel.raw.id);
    const timer = activeTimers.find((t) => t.channelId === channel.raw.id);
    if (liveVideo && timer) {
      const liveInfoContainer = favoriteCard.querySelector(`[id^='live_info_']`);
      if (liveInfoContainer) {
        liveInfoContainer.innerHTML = "";
        const liveDiv = createLiveDiv(liveVideo, timer);
        liveInfoContainer.appendChild(liveDiv);
        liveInfoContainer.style.display = "block";
      }
    } else {
      const scheduledVideo = scheduledVideos.find((v) => v.raw.channel.id === channel.raw.id);
      if (scheduledVideo) {
        const scheduleInfoContainer = favoriteCard.querySelector(`[id^='scheduled_info_']`);
        if (scheduleInfoContainer) {
          scheduleInfoContainer.innerHTML = "";
          const scheduleCard = createScheduleCard(scheduledVideo);
          scheduleInfoContainer.appendChild(scheduleCard);
          scheduleInfoContainer.style.display = "block";
        }
      }
    }
    favoritesContainer.appendChild(favoriteCard);
  });
  updateLiveFavorites();

  if (favoritesContainer.children.length === 0) {
    favoritesDetails.classList.add("disabled-details");
    favoritesDetails.open = false;
  } else {
    favoritesDetails.classList.remove("disabled-details");
  }
}

function initSortable() {
  const favoritesContainer = document.getElementById("favorites");
  if (favoritesContainer) {
    new Sortable(favoritesContainer, {
      animation: 150,
      ghostClass: "sortable-ghost",
      onEnd: function (evt) {
        const newFavoritesOrder = Array.from(evt.to.children).map((el) => {
          const id = el.id.replace("profile_article_", "");
          return id;
        });
        favorites = newFavoritesOrder;
        window.ipcRender.send("setting:save", { favorites: favorites });
      },
    });
  }
}

function updateLiveFavorites() {
  document.querySelectorAll("#live .artile").forEach((card) => {
    const channelId = card.id.replace("live_section_card_", "");
    const starIcon = card.querySelector(".favorite-btn");
    if (starIcon) {
      starIcon.classList.toggle("fas", favorites.includes(channelId));
      starIcon.classList.toggle("far", !favorites.includes(channelId));
    }
  });
}

function updateCardLiveStatus(channelId, video, timer) {
  const cards = document.querySelectorAll(`#profile_article_${channelId}, #favorites #profile_article_${channelId}`);
  cards.forEach((card) => {
    const liveInfoContainer = card.querySelector(`[id^='live_info_']`);
    if (!liveInfoContainer) return;

    liveInfoContainer.innerHTML = ""; // Clear previous content
    if (video) {
      const liveDiv = createLiveDiv(video, timer);
      liveInfoContainer.appendChild(liveDiv);
      liveInfoContainer.style.display = "block";
      liveInfoContainer.style.display = "block";

      const scheduleInfoContainer = card.querySelector(`[id^='scheduled_info_']`);
      if (scheduleInfoContainer && card.closest("#live")) {
        scheduleInfoContainer.style.display = "none";
      }
    } else {
      liveInfoContainer.style.display = "none";
      const scheduleInfoContainer = card.querySelector(`[id^='scheduled_info_']`);
      if (scheduleInfoContainer && scheduleInfoContainer.hasChildNodes()) {
        scheduleInfoContainer.style.display = "block";
      }
    }
  });
}

function updateCardScheduleStatus(channelId, video) {
  const cards = document.querySelectorAll(`#profile_article_${channelId}, #favorites #profile_article_${channelId}`);
  cards.forEach((card) => {
    const scheduledInfoContainer = card.querySelector(`[id^='scheduled_info_']`);
    if (scheduledInfoContainer) {
      scheduledInfoContainer.innerHTML = ""; // Clear previous
      const scheduleCard = createScheduleCard(video);
      scheduledInfoContainer.appendChild(scheduleCard);

      const liveInfoContainer = card.querySelector(`[id^='live_info_']`);
      if (!liveInfoContainer || liveInfoContainer.style.display === "none" || !card.closest("#live")) {
        scheduledInfoContainer.style.display = "block";
      }
    }
  });
}

// --- Utility Functions ---
async function scrollUp() {
  const c = document.documentElement.scrollTop || document.body.scrollTop;
  if (c > 0) {
    window.requestAnimationFrame(scrollUp);
    window.scrollTo(0, c - c / 8);
  }
}

function scheduletime(value) {
  const scheduledDiv = document.createElement("div");
  const scheduled = new Date(value);
  scheduledDiv.innerHTML = `<i class="far fa-calendar-alt" style="margin-right: 4px;"></i><small><b>${String(
    scheduled.getFullYear()
  ).substr(-2)}.${String(scheduled.getMonth() + 1)}.${String(scheduled.getDate())} ${String(scheduled.getHours()).padStart(
    2,
    "0"
  )}:${String(scheduled.getMinutes()).padStart(2, "0")}</b></small>`;
  return scheduledDiv;
}

function topic(value) {
  const topicDiv = document.createElement("div");
  topicDiv.className = "topic-wrapper";

  if (value) {
    let icon = "✎";
    let text = String(value).replace(/_/g, " ");
    let style = "";

    switch (value) {
      case "Birthday":
        icon = "🍰";
        style = `color: var(--birthday-color); font-weight: bold; text-shadow: 0 0 2px var(--birthday-shadow);`;
        break;
      case "singing":
        icon = "🎶";
        break;
    }
    topicDiv.innerHTML = `<span style="${style}">${icon} ${text}</span>`;
  }
  return topicDiv;
}

// --- Event Delegation Setup ---
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});

function setupEventListeners() {
  // Listen for details toggle events to update the action button
  document.body.addEventListener("toggle", (event) => {
    if (event.target.tagName === "DETAILS") {
      updateActionBtnState();
    }
  }, true); // Use capture phase to ensure it fires

  // Attach to the body for more robust event handling
  document.body.addEventListener("click", (event) => {
    const target = event.target;
    const article = target.closest("article.artile");
    if (!article) return;

    const channelId = article.dataset.channelId;
    if (!channelId) return;

    if (target.matches(".favorite-btn")) {
      event.stopPropagation();
      toggleFavorite(channelId);
      return;
    }

    const liveInfo = target.closest(".live-info-content");
    if (liveInfo && liveInfo.dataset.videoId) {
      window.ipcRender.send("live_url:send", liveInfo.dataset.videoId);
      return;
    }

    const scheduleItem = target.closest(".schedule-item");
    if (scheduleItem) {
      const scheduledVideo = scheduledVideos.find((v) => v.raw.channel.id === channelId);
      if (scheduledVideo) {
        window.ipcRender.send("live_url:send", scheduledVideo.raw.id);
      }
      return;
    }

    if (target.matches(".eng_name, .photo")) {
      window.ipcRender.send("channel_url:send", channelId);
      return;
    }
  });
}

function setupApiKeyField(isVerified) {
  apiKeyStatusMessage.classList.remove("status-success", "status-error");
  apiKeyInput.disabled = false;

  if (isVerified) {
    saveApiKeyBtn.disabled = false;
    apiKeyStatusMessage.innerHTML = `<i class="fas fa-check-circle"></i> API Key is verified.`;
    apiKeyStatusMessage.classList.add("status-success");
  } else {
    saveApiKeyBtn.disabled = true;
    apiKeyStatusMessage.innerHTML = ``; // Clear message
    if (apiKeyInput.value) {
      apiKeyStatusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> API Key needs re-validation.`;
      apiKeyStatusMessage.classList.add("status-error");
    }
  }
}
