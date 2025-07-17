let favorites = [];
let allChannels = [];
let activeTimers = [];
let liveVideos = [];
let scheduledVideos = [];
let animationFrameId;

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = settingsModal.querySelector('.close');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const themeSwitch = document.getElementById('theme-switch');
const closeActionSelect = document.getElementById('close-action-select');
const notifyOnTraySwitch = document.getElementById('notify-on-tray-switch');
const liveNotificationSelect = document.getElementById('live-notification-select');
const currentVersionSpan = document.getElementById('current-version');
const checkForUpdateBtn = document.getElementById('check-for-update-btn');
// const updateStatusP = document.getElementById('update-status'); // No longer needed

// --- Event Listeners ---
checkForUpdateBtn.addEventListener('click', (event) => {
  event.preventDefault(); // Prevent default link behavior
  if (checkForUpdateBtn.classList.contains('disabled')) return;
  // updateStatusP.innerText = ''; // No longer needed
  window.ipcRender.send('update:check');
});

settingsBtn.addEventListener('click', () => {
  settingsModal.showModal();
});

closeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  settingsModal.close();
});

saveApiKeyBtn.addEventListener('click', () => {
  const settingsToSave = {
    apiKey: apiKeyInput.value,
    theme: themeSwitch.checked ? 'dark' : 'light',
    closeAction: closeActionSelect.value,
    notifyOnTray: notifyOnTraySwitch.checked,
    liveNotifications: liveNotificationSelect.value
  };
  
  window.ipcRender.send("setting:save", settingsToSave);
  
  // Force a reload to ensure a clean state, as requested.
  location.reload();
});


themeSwitch.addEventListener('change', () => {
  const theme = themeSwitch.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
});

reload.addEventListener("click", (evt) => {
  if (reload.states === "scrollUp") {
    scrollUp();
  } else {
    const allDetails = document.querySelectorAll("details");
    allDetails.forEach((detail) => {
      detail.removeAttribute("open");
    });
  }
});

window.onscroll = function () {
  if (document.documentElement.scrollTop || document.body.scrollTop > 0) {
    reload.innerText = "▲";
    reload.states = "scrollUp";
  } else {
    reload.innerText = "↻";
    reload.states = "reload";
  }
};

// --- IPC Renderers ---
window.ipcRender.receive("setting:load", (data) => {
  if (!data.apiKey) {
    settingsModal.showModal();
  }
  apiKeyInput.value = data.apiKey || '';
  
  const currentTheme = data.theme || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  themeSwitch.checked = currentTheme === 'dark';

  const closeAction = data.closeAction || 'tray';
  closeActionSelect.value = closeAction;

  const notifyOnTray = data.notifyOnTray === undefined ? true : data.notifyOnTray;
  notifyOnTraySwitch.checked = notifyOnTray;

  const liveNotifications = data.liveNotifications || 'all';
  liveNotificationSelect.value = liveNotifications;

  favorites = data.favorites || [];
});

window.ipcRender.receive('update:status', ({ status, data }) => {
  console.log('Update status received:', status, data);
  const updateIcon = checkForUpdateBtn.querySelector('i');
  
  // Always re-enable the button unless checking is in progress
  checkForUpdateBtn.classList.remove('disabled');
  updateIcon.classList.remove('fa-spin');

  switch (status) {
    case 'checking':
      checkForUpdateBtn.classList.add('disabled');
      updateIcon.classList.add('fa-spin');
      break;
    case 'current-version':
      currentVersionSpan.innerText = data;
      break;
    // Other statuses are now handled by main process notifications
  }
});

window.ipcRender.receive("channel:load", (data) => {
  const mainContainer = document.getElementById("main");
  const existingError = document.getElementById('api-error-message');
  if (existingError) existingError.remove();

  allChannels = data;
  
  // Clear existing channel groups except for LIVE and Favorites
  const detailsToRemove = mainContainer.querySelectorAll("details:not(#live-details):not(#favorites-details)");
  detailsToRemove.forEach(d => d.remove());

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
});

window.ipcRender.receive("api:error", (error) => {
  const mainContainer = document.getElementById("main");
  
  // Clear content without removing the main details elements
  const liveContainer = document.getElementById("live");
  if (liveContainer) liveContainer.innerHTML = "";

  const favoritesContainer = document.getElementById("favorites");
  if (favoritesContainer) favoritesContainer.innerHTML = "";

  // Remove only the dynamically generated channel groups
  if (mainContainer) {
    const detailsToRemove = mainContainer.querySelectorAll("details:not(#live-details):not(#favorites-details)");
    detailsToRemove.forEach(d => d.remove());
  }

  const existingError = document.getElementById('api-error-message');
  if (existingError) existingError.remove();

  const errorDiv = document.createElement('div');
  errorDiv.id = 'api-error-message';
  errorDiv.innerHTML = `<h2>API Error</h2><p>${error.message}</p><p>Please open settings (⚙️) and enter a valid API key.</p>`;
  mainContainer.appendChild(errorDiv);
});

window.ipcRender.receive("live:load", (newLiveVideos) => {
  liveVideos = newLiveVideos;
  const liveDetails = document.getElementById('live-details');
  const liveContainer = document.getElementById("live");
  
  const currentlyLiveIds = newLiveVideos.map(v => v.raw.channel.id);
  const previousLiveIds = activeTimers.map(t => t.channelId);

  // Identify streams that have ended
  const endedStreamIds = previousLiveIds.filter(id => !currentlyLiveIds.includes(id));
  endedStreamIds.forEach(channelId => {
    // Remove from live section
    const articleToRemove = document.getElementById(`live_section_card_${channelId}`);
    if (articleToRemove) liveContainer.removeChild(articleToRemove);
    
    // Clear live info from all cards
    updateCardLiveStatus(channelId, null);
  });
  
  // Filter out ended timers
  activeTimers = activeTimers.filter(timer => currentlyLiveIds.includes(timer.channelId));

  // Add new or update existing streams
  newLiveVideos.forEach(video => {
    const channelId = video.raw.channel.id;
    let timer = activeTimers.find(t => t.channelId === channelId);

    if (!timer) {
      // New live stream
      timer = {
        channelId: channelId,
        startTime: new Date(video.raw.start_actual),
        elements: [] // Changed to elements array
      };
      activeTimers.push(timer);
      createLiveCard(video, timer);
    } else {
      // If timer already exists, check if startTime needs to be updated.
      if (isNaN(timer.startTime.getTime()) && video.raw.start_actual) {
        timer.startTime = new Date(video.raw.start_actual);
      }
       // Update existing live info (viewers, etc.)
       updateCardLiveStatus(channelId, video, timer);
    }
  });

  // Manage animation frame loop
  if (activeTimers.length > 0 && !animationFrameId) {
    animationFrameId = requestAnimationFrame(updateAllTimers);
  } else if (activeTimers.length === 0 && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Disable details if empty
  if (liveContainer.children.length === 0) {
    liveDetails.classList.add('disabled-details');
  } else {
    liveDetails.classList.remove('disabled-details');
  }
  updateLiveFavorites();
});

window.ipcRender.receive("scheduled:load", (newScheduledVideos) => {
  scheduledVideos = newScheduledVideos;
  // Clear all existing schedule info first
  const allScheduledInfo = document.querySelectorAll("[id^='scheduled_info_']");
  allScheduledInfo.forEach(info => {
    info.innerHTML = "";
    info.style.display = "none";
  });

  newScheduledVideos.forEach(video => {
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
    itemsContainer.id = groupName.replace(/\s/g, '');

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
    article.style.setProperty('--bg-image', `url(${channel.raw.photo})`);
    if (channel.raw.banner) article.dataset.bannerUrl = channel.raw.banner;

    const photo = document.createElement("img");
    photo.className = "photo";
    photo.src = channel.raw.photo;
    photo.draggable = false;
    photo.style.cursor = "pointer";
    
    photo.onerror = () => {
      // If image fails to load, remove the entire card
      article.remove();
    };

    photo.addEventListener("click", () => {
        if (article.dataset.bannerUrl) {
            // This functionality is deprecated.
        }
    });

    const infoContainer = document.createElement("div");
    infoContainer.className = "info-container";

    const nameContainer = document.createElement("div");
    nameContainer.style.display = "flex";
    nameContainer.style.alignItems = "center";

    const eng_name = document.createElement("header");
    eng_name.className = "eng_name";
    eng_name.innerText = channel.raw.english_name;
    eng_name.style.cursor = "pointer";
    eng_name.addEventListener("click", () => window.ipcRender.send("channel_url:send", channel.raw.id));

    const favoriteBtn = document.createElement("i");
    favoriteBtn.className = `favorite-btn ${favorites.includes(uniqueId) ? 'fas' : 'far'} fa-star`;
    favoriteBtn.style.cursor = "pointer";
    favoriteBtn.style.marginLeft = "0.5rem";
    favoriteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(uniqueId);
    });

    nameContainer.appendChild(eng_name);
    nameContainer.appendChild(favoriteBtn);

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
    const originalArticle = document.getElementById(`profile_article_${channelId}`);
    
    if (originalArticle) {
        const clone = originalArticle.cloneNode(true);
        clone.id = `live_section_card_${channelId}`;

        // Add event listener to the favorite button on the clone
        const favoriteBtn = clone.querySelector('.favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(channelId);
            });
        }

        const infoContainer = clone.querySelector('.info-container');
        
        // Remove placeholder footers
        const liveInfoPlaceholder = infoContainer.querySelector(`[id^='live_info_']`);
        if(liveInfoPlaceholder) liveInfoPlaceholder.remove();
        const scheduledInfoPlaceholder = infoContainer.querySelector(`[id^='scheduled_info_']`);
        if(scheduledInfoPlaceholder) scheduledInfoPlaceholder.remove();

        const liveDiv = createLiveDiv(video, timer);
        infoContainer.appendChild(liveDiv);
        
        liveContainer.insertBefore(clone, liveContainer.firstChild);
        
        // Update all cards for this channel
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
    scheduledDiv.addEventListener("click", () => window.ipcRender.send("live_url:send", video.raw.id));
    
    return scheduledDiv;
}

function createLiveDiv(video, timer) {
    const liveDiv = document.createElement("div");
    liveDiv.className = 'live-info-content';
    if (video.raw.topic_id === "membersonly") liveDiv.setAttribute("data-theme", "light");
    
    const title = document.createElement("span");
    title.innerText = video.raw.title;
    
    const uptime = document.createElement("div");
    uptime.className = "uptime-timer";
    if (timer) timer.elements.push(uptime);
    
    const viewer = document.createElement("small");
    viewer.className = "viewer-count";
    if (video.raw.topic_id !== "membersonly") {
        viewer.innerHTML = `<i class="fas fa-eye" style="color: var(--holo-blue);"></i>   ${video.raw.live_viewers.toLocaleString("en-US")} watching     `;
    }
    
    const topicDiv = topic(video.raw.topic_id);
    
    liveDiv.appendChild(title);
    liveDiv.appendChild(uptime);
    liveDiv.appendChild(viewer);
    liveDiv.appendChild(topicDiv);
    liveDiv.style.cursor = "pointer";
    liveDiv.addEventListener("click", () => window.ipcRender.send("live_url:send", video.raw.id));
    
    return liveDiv;
}

// --- Timer & Update Functions ---
function updateAllTimers() {
  activeTimers.forEach(timer => {
    const now = new Date();
    let timeString;

    if (timer.startTime && !isNaN(timer.startTime.getTime())) {
      const uptime = new Date(now - timer.startTime);
      timeString = 
          `<i class="fas fa-signal" style="color: var(--holo-blue); margin-right: 4px;"></i><span style="color:rgba(255, 60, 60);">    ${String(uptime.getUTCHours()).padStart(2, "0")}:${String(
            uptime.getUTCMinutes()
          ).padStart(2, "0")}:${String(uptime.getUTCSeconds()).padStart(2, "0")}</span>`;
    } else {
      timeString = `<i class="fas fa-spinner fa-spin" style="color: var(--holo-blue); margin-right: 4px;"></i><span style="color: var(--text-secondary);">Waiting...</span>`;
    }
    
    timer.elements.forEach(element => {
        if(element) element.innerHTML = timeString;
    });
  });

  animationFrameId = requestAnimationFrame(updateAllTimers);
}

function toggleFavorite(channelId) {
  const index = favorites.indexOf(channelId);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(channelId);
  }
  
  window.ipcRender.send("setting:save", { favorites: favorites });
  updateFavoriteStar(channelId);
  updateFavoritesSection();
}

function updateFavoriteStar(channelId) {
  document.querySelectorAll(`#profile_article_${channelId} .favorite-btn, #favorites #profile_article_${channelId} .favorite-btn, #live #live_section_card_${channelId} .favorite-btn`).forEach(starIcon => {
    starIcon.classList.toggle("fas", favorites.includes(channelId));
    starIcon.classList.toggle("far", !favorites.includes(channelId));
  });
}

function updateFavoritesSection() {
  const favoritesContainer = document.getElementById("favorites");
  const favoritesDetails = favoritesContainer.closest('details');
  if (!favoritesContainer) return;
  favoritesContainer.innerHTML = "";

  favorites.forEach(channelId => {
    const originalArticle = document.getElementById(`profile_article_${channelId}`);
    if (originalArticle) {
      const clone = originalArticle.cloneNode(true);
      
      clone.querySelector('.favorite-btn')?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(channelId);
      });
      clone.querySelector('.eng_name')?.addEventListener('click', () => window.ipcRender.send("channel_url:send", channelId));
      clone.querySelector('.photo')?.addEventListener('click', () => {
        if (clone.dataset.bannerUrl) {
            // This functionality is deprecated.
        }
      });

      // Manually sync live/schedule status on clone creation
      const liveVideo = liveVideos.find(v => v.raw.channel.id === channelId);
      const timer = activeTimers.find(t => t.channelId === channelId);
      if (liveVideo && timer) {
        const liveInfoContainer = clone.querySelector(`[id^='live_info_']`);
        if (liveInfoContainer) {
            liveInfoContainer.innerHTML = "";
            const liveDiv = createLiveDiv(liveVideo, timer);
            liveInfoContainer.appendChild(liveDiv);
            liveInfoContainer.style.display = "block";
        }
      } else {
        const scheduledVideo = scheduledVideos.find(v => v.raw.channel.id === channelId);
        if (scheduledVideo) {
            const scheduleInfoContainer = clone.querySelector(`[id^='scheduled_info_']`);
            if (scheduleInfoContainer) {
                scheduleInfoContainer.innerHTML = "";
                const scheduleCard = createScheduleCard(scheduledVideo);
                scheduleInfoContainer.appendChild(scheduleCard);
                scheduleInfoContainer.style.display = "block";
            }
        }
      }

      favoritesContainer.appendChild(clone);
    }
  });
  updateLiveFavorites();

  if (favoritesContainer.children.length === 0) {
    favoritesDetails.classList.add('disabled-details');
    favoritesDetails.open = false;
  } else {
    favoritesDetails.classList.remove('disabled-details');
  }
}

function updateLiveFavorites() {
    document.querySelectorAll('#live .artile').forEach(card => {
        const channelId = card.id.replace('live_section_card_', '');
        const starIcon = card.querySelector('.favorite-btn');
        if (starIcon) {
            starIcon.classList.toggle('fas', favorites.includes(channelId));
            starIcon.classList.toggle('far', !favorites.includes(channelId));
        }
    });
}

function updateCardLiveStatus(channelId, video, timer) {
    const cards = document.querySelectorAll(`#profile_article_${channelId}, #favorites #profile_article_${channelId}`);
    cards.forEach(card => {
        const liveInfoContainer = card.querySelector(`[id^='live_info_']`);
        if (!liveInfoContainer) return;

        liveInfoContainer.innerHTML = ""; // Clear previous content
        if (video) {
            // If live, create and append live div
            const liveDiv = createLiveDiv(video, timer);
            liveInfoContainer.appendChild(liveDiv);
            liveInfoContainer.style.display = "block";
            liveInfoContainer.addEventListener("click", () => window.ipcRender.send("live_url:send", video.raw.id));
            
            const scheduleInfoContainer = card.querySelector(`[id^='scheduled_info_']`);
            // Hide schedule info only if the card is in the main LIVE section
            if (scheduleInfoContainer && card.closest('#live')) {
                 scheduleInfoContainer.style.display = "none";
            }

        } else {
            // If not live, hide container and check if schedule can be restored
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
    cards.forEach(card => {
        const scheduledInfoContainer = card.querySelector(`[id^='scheduled_info_']`);
        if (scheduledInfoContainer) {
            scheduledInfoContainer.innerHTML = ""; // Clear previous
            const scheduleCard = createScheduleCard(video);
            scheduledInfoContainer.appendChild(scheduleCard);
            
            // Only display if not currently live in a non-LIVE section card
            const liveInfoContainer = card.querySelector(`[id^='live_info_']`);
            if (!liveInfoContainer || liveInfoContainer.style.display === 'none' || !card.closest('#live')) {
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
  scheduledDiv.innerHTML =
    `<i class="far fa-calendar-alt" style="margin-right: 4px;"></i><small><b>${String(scheduled.getFullYear()).substr(-2)}.${String(scheduled.getMonth() + 1)}.${String(scheduled.getDate())} ${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}</b></small>`;
  return scheduledDiv;
}

function topic(value) {
  var topicDiv = document.createElement("sub");
  if (value) {
    switch (value) {
      case "Birthday":
        topicDiv.innerHTML = "<span style='color: yellow; font-weight: bold'; >🍰 " + String(value).replace(/_/g, " ") + "<br/></span>";
        break;
      case "singing":
        topicDiv.innerHTML = "🎶 " + String(value).replace(/_/g, " ") + "<br/>";
        break;
      default:
        topicDiv.innerHTML = "✎ " + String(value).replace(/_/g, " ") + "<br/>";
    }
  }
  return topicDiv;
}
