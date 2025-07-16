let interval = {};
let isFirstLoad = true;
let favorites = [];
let allChannels = [];

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = settingsModal.querySelector('.close');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');

settingsBtn.addEventListener('click', () => {
  settingsModal.showModal();
});

closeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  settingsModal.close();
});

saveApiKeyBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  if (apiKey) {
    const errorContainer = document.getElementById('error-container');
    errorContainer.style.display = 'none';
    window.ipcRender.send("setting:save", { apiKey: apiKey });
    settingsModal.close();
    // Optionally, show a success message to the user
  }
});

window.ipcRender.receive("setting:load", (data) => {
  if (!data.apiKey) {
    settingsModal.showModal();
  }
  apiKeyInput.value = data.apiKey || '';
  favorites = data.favorites || [];
  if (data.backgroundUrl) {
    changeBackground(data.backgroundUrl);
  } else if (data.background) {
    // Fallback for old settings
    const localImagePath = `../img/background/${data.background}.png`;
    changeBackground(localImagePath);
  }
  changeTheme(data.background); // For theme-specific CSS variables
});

window.ipcRender.receive("channel:load", (data) => {
  const mainContainer = document.getElementById("main");
  const existingError = document.getElementById('api-error-message');
  if (existingError) {
    existingError.remove();
  }

  allChannels = data;
  
  while (mainContainer.children.length > 2) {
    mainContainer.removeChild(mainContainer.lastChild);
  }

  const channelsByGroup = data.reduce((acc, channel) => {
    const group = channel.raw.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(channel);
    return acc;
  }, {});

  for (const groupName in channelsByGroup) {
    if (groupName === "undefined") continue;

    const channels = channelsByGroup[groupName];
    
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.className = "gen";
    summary.textContent = groupName;
    
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "items";
    itemsContainer.id = groupName.replace(/\s/g, '');

    channels.forEach((channel) => {
      const article = document.createElement("article");
      article.classList.add("artile");
      const uniqueId = channel.raw.id;
      article.id = `profile_article_${uniqueId}`;
      article.style.setProperty('--bg-image', `url(${channel.raw.photo})`);
      if (channel.raw.banner) {
        article.dataset.bannerUrl = channel.raw.banner;
      }

      const photo = document.createElement("img");
      photo.className = "photo";
      photo.src = channel.raw.photo;
      photo.draggable = false;
      photo.style.cursor = "pointer";
      photo.addEventListener("click", () => {
        if (article.dataset.bannerUrl) {
          changeBackground(article.dataset.bannerUrl);
          window.ipcRender.send("setting:save", { backgroundUrl: article.dataset.bannerUrl });
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
      eng_name.addEventListener("click", () => {
        window.ipcRender.send("channel_url:send", channel.raw.id);
      });

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
      itemsContainer.appendChild(article);
    });

    details.appendChild(summary);
    details.appendChild(itemsContainer);
    mainContainer.appendChild(details);
  }
  updateFavoritesSection();
});

window.ipcRender.receive("api:error", (error) => {
  const mainContainer = document.getElementById("main");
  // Remove existing channel/favorites sections
  const detailsToRemove = mainContainer.querySelectorAll("details:not(:first-child)");
  detailsToRemove.forEach(detail => detail.remove());

  // Remove previous error message if it exists
  const existingError = document.getElementById('api-error-message');
  if (existingError) {
    existingError.remove();
  }

  // Create and display a new prominent error message
  const errorDiv = document.createElement('div');
  errorDiv.id = 'api-error-message';
  errorDiv.innerHTML = `
    <h2>API Error</h2>
    <p>${error.message}</p>
    <p>Please open settings (⚙️) and enter a valid API key.</p>
  `;
  mainContainer.appendChild(errorDiv);
});

window.ipcRender.receive("live:load", (liveVideos) => {
  const liveContainer = document.getElementById("live");
  const currentlyLiveIds = liveVideos.map(v => v.raw.channel.id);
  const previouslyLiveIds = Array.from(liveContainer.children).map(c => c.id.replace('live_section_card_', ''));

  previouslyLiveIds.forEach(channelId => {
    if (!currentlyLiveIds.includes(channelId)) {
      const articleToRemove = document.getElementById(`live_section_card_${channelId}`);
      if (articleToRemove) {
        liveContainer.removeChild(articleToRemove);
      }
      const liveInfo = document.getElementById(`live_info_${channelId}`);
      if (liveInfo) {
        liveInfo.style.display = "none";
        liveInfo.innerHTML = "";
      }
      removeInterval(channelId);
    }
  });

  liveVideos.forEach(video => {
    const channelId = video.raw.channel.id;
    const liveInfoContainer = document.getElementById(`live_info_${channelId}`);
    const liveSectionCard = document.getElementById(`live_section_card_${channelId}`);

    if (!liveInfoContainer) return;

    const liveDiv = document.createElement("div");
    liveDiv.className = 'live-info-content';
    if (video.raw.topic_id === "membersonly") {
      liveDiv.setAttribute("data-theme", "light");
    }
    const title = document.createElement("span");
    title.innerText = video.raw.title;
    const uptime = liveUptime(video.raw.start_actual, channelId);
    const viewer = document.createElement("small");
    if (video.raw.topic_id !== "membersonly") {
      viewer.innerHTML = `<i class="fas fa-eye"></i> ${video.raw.live_viewers.toLocaleString("en-US")} watching`;
    }
    const topicDiv = topic(video.raw.topic_id);
    liveDiv.appendChild(title);
    liveDiv.appendChild(uptime);
    liveDiv.appendChild(viewer);
    liveDiv.appendChild(topicDiv);

    liveInfoContainer.innerHTML = "";
    liveInfoContainer.appendChild(liveDiv);
    liveInfoContainer.style.display = "block";

    if (!liveSectionCard) {
        const originalArticle = document.getElementById(`profile_article_${channelId}`);
        if (originalArticle) {
            const clone = originalArticle.cloneNode(true);
            clone.id = `live_section_card_${channelId}`;
            const infoContainer = clone.querySelector('.info-container');
            infoContainer.querySelector(`#live_info_${channelId}`).remove();
            infoContainer.querySelector(`#scheduled_info_${channelId}`).remove();
            
            const liveDivClone = liveDiv.cloneNode(true);
            liveDivClone.style.cursor = "pointer";
            liveDivClone.addEventListener("click", () => {
                window.ipcRender.send("live_url:send", video.raw.id);
            });
            infoContainer.appendChild(liveDivClone);
            
            liveContainer.insertBefore(clone, liveContainer.firstChild);
        }
    }
  });
  updateLiveFavorites();
});

window.ipcRender.receive("scheduled:load", (scheduledVideos) => {
  const allScheduleInfos = document.querySelectorAll("[id^='scheduled_info_']");
  allScheduleInfos.forEach(info => {
    info.innerHTML = "";
    info.style.display = "none";
  });

  scheduledVideos.forEach(video => {
    const channelId = video.raw.channel.id;
    const scheduledInfoContainer = document.getElementById(`scheduled_info_${channelId}`);

    if (scheduledInfoContainer) {
      const scheduledDiv = document.createElement("article");
      scheduledDiv.className = "schedule-item";
      scheduledDiv.style.margin = 0;
      if (video.raw.topic_id === "membersonly") {
        scheduledDiv.setAttribute("data-theme", "light");
      }

      const title = document.createElement("span");
      title.innerText = video.raw.title;

      const schedule = scheduletime(video.raw.start_scheduled);
      const topicDiv = topic(video.raw.topic_id);

      scheduledDiv.appendChild(title);
      scheduledDiv.appendChild(schedule);
      scheduledDiv.appendChild(topicDiv);
      scheduledDiv.style.cursor = "pointer";
      scheduledDiv.addEventListener("click", () => {
        window.ipcRender.send("live_url:send", video.raw.id);
      });

      scheduledInfoContainer.appendChild(scheduledDiv);
      scheduledInfoContainer.style.display = "block";
    }
  });
});

function liveUptime(value, channelId) {
  const uptimeDiv = document.createElement("div");
  uptimeDiv.setAttribute("id", "uptime");

  if (value) {
    if (interval[channelId]) {
      clearInterval(interval[channelId]);
    }
    const start_actual = new Date(value);
    const update = () => {
      const current_time = new Date();
      const uptimeDate = new Date(current_time - start_actual);
      uptimeDiv.innerHTML =
        `<i class="fas fa-signal"></i> <span style="color:rgba(255, 60, 60);">${String(uptimeDate.getUTCHours()).padStart(2, "0")}:${String(
          uptimeDate.getUTCMinutes()
        ).padStart(2, "0")}:${String(uptimeDate.getUTCSeconds()).padStart(2, "0")}</span>`;
    };
    interval[channelId] = setInterval(update, 1000);
    update();
  } else {
    uptimeDiv.innerHTML = '<small style="color:#FF0000">Waiting for Stream...</small>';
  }
  return uptimeDiv;
}

window.onscroll = function (e) {
  if (document.documentElement.scrollTop || document.body.scrollTop > 0) {
    reload.innerText = "▲";
    reload.states = "scrollUp";
  } else {
    reload.innerText = "↻";
    reload.states = "reload";
  }
};

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
    `<i class="far fa-calendar-alt"></i> <small><b>${String(scheduled.getFullYear()).substr(-2)}.${String(scheduled.getMonth() + 1)}.${String(scheduled.getDate())} ${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}</b></small>`;
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

function changeBackground(imageUrl) {
  document.getElementById("body").style.backgroundImage = `url('${imageUrl}')`;
}

function changeTheme(target) {
  // This function can now be used for theme-specific CSS variables, not the main background
  if(target) document.getElementById("body").setAttribute("theme", target);
}

function removeInterval(channelId) {
  clearInterval(interval[channelId]);
  delete interval[channelId];
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
  const starIcons = document.querySelectorAll(`#profile_article_${channelId} .favorite-btn, #favorites #profile_article_${channelId} .favorite-btn`);
  starIcons.forEach(starIcon => {
    if (favorites.includes(channelId)) {
      starIcon.classList.remove("far");
      starIcon.classList.add("fas");
    } else {
      starIcon.classList.remove("fas");
      starIcon.classList.add("far");
    }
  });
}

function updateFavoritesSection() {
  const favoritesContainer = document.getElementById("favorites");
  if (!favoritesContainer) return;
  favoritesContainer.innerHTML = "";

  favorites.forEach(channelId => {
    const originalArticle = document.getElementById(`profile_article_${channelId}`);
    if (originalArticle) {
      const clone = originalArticle.cloneNode(true);
      
      const favoriteBtn = clone.querySelector('.favorite-btn');
      if(favoriteBtn) {
        favoriteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleFavorite(channelId);
        });
      }
      const nameHeader = clone.querySelector('.eng_name');
      if(nameHeader) {
        nameHeader.addEventListener('click', () => {
          window.ipcRender.send("channel_url:send", channelId);
        });
      }
      const photoImg = clone.querySelector('.photo');
      if(photoImg) {
        photoImg.addEventListener('click', () => {
          const themeName = nameHeader.innerText.split(" ")[0];
          changeTheme(themeName);
          window.ipcRender.send("setting:save", { background: themeName });
        });
      }
      favoritesContainer.appendChild(clone);
    }
  });
  updateLiveFavorites();
}

function updateLiveFavorites() {
    const liveCards = document.querySelectorAll('#live .artile');
    liveCards.forEach(card => {
        const channelId = card.id.replace('live_section_card_', '');
        const starIcon = card.querySelector('.favorite-btn');
        if (starIcon) {
            if (favorites.includes(channelId)) {
                starIcon.classList.remove('far');
                starIcon.classList.add('fas');
            } else {
                starIcon.classList.remove('fas');
                starIcon.classList.add('far');
            }
        }
    });
}
