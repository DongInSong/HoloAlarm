let onAir = [];
let onAirObject = {};
let interval = {};
let isFirstLoad = true;

function sliceData(data) {
  data.splice(93, 5);
  data.splice(87, 5);
  data.splice(54, 24);
  var splice = [49, 44, 38, 30, 26, 21, 15, 10, 9];
  for (i = 0; i < splice.length; i++) {
    data.splice(splice[i], 1);
  }
}

window.ipcRender.receive("setting:load", (data) => {
  // document.getElementById("body").style.backgroundImage = "url(./img/background/" + data["background"] + ".png)";
  // document.getElementsByClassName("live_btn")[0].setAttribute("theme", data["background"]);
  changeTheme(data["background"]);
  changeAlarm(data["alarm"]);
});

window.ipcRender.receive("channel:load", (data) => {
  sliceData(data);

  for (i = 0; i < data.length - 1; i++) {
    let artile = document.createElement("article");
    let eng_name = document.createElement("header");
    let live_info = document.createElement("footer");
    let scheduled_info = document.createElement("footer");
    let photo = document.createElement("img");
    artile.classList = "artile";
    eng_name.className = "eng_name";
    photo.className = "photo";
    live_info.style.display = "none";
    live_info.style.padding = 0;
    scheduled_info.style.display = "none";
    scheduled_info.style.padding = 0;

    eng_name.style.cursor = "pointer";
    let id = data[i].raw.id;
    eng_name.addEventListener("click", (evt) => {
      window.ipcRender.send("channel_url:send", id);
    });

    eng_name.setAttribute("id", "name_" + i);
    photo.setAttribute("id", "photo_" + i);
    live_info.setAttribute("id", "live_info_" + i);
    scheduled_info.setAttribute("id", "scheduled_info_" + i);
    artile.setAttribute("id", "profile_artile_" + i);

    photo.style.cursor = "pointer";
    photo.draggable = false;
    photo.addEventListener("click", (evt) => {
      changeTheme(eng_name.innerText.split(" ")[0]);
      let obj = new Object();
      obj.background = eng_name.innerText.split(" ")[0];
      window.ipcRender.send("setting:save", obj);
    });

    artile.appendChild(eng_name);
    artile.appendChild(photo);
    artile.appendChild(live_info);
    artile.appendChild(scheduled_info);
    if (i < 5) Gen0.appendChild(artile);
    else if (i < 10) Gen1.appendChild(artile);
    else if (i < 15) Gen2.appendChild(artile);
    else if (i < 19) Gen3.appendChild(artile);
    else if (i < 23) Gen4.appendChild(artile);
    else if (i < 27) Gen5.appendChild(artile);
    else if (i < 32) Gen6.appendChild(artile);
    else if (i < 37) Councilrys.appendChild(artile);
    else if (i < 42) Myth.appendChild(artile);
    else if (i < 45) Gamers.appendChild(artile);
    else if (i < 48) ID1.appendChild(artile);
    else if (i < 51) ID2.appendChild(artile);
    else if (i < 54) ID3.appendChild(artile);

    document.getElementById("name_" + i).innerText = data[i].raw.english_name;
    document.getElementById("photo_" + i).src = data[i].raw.photo;
  }
});

window.ipcRender.receive("live:load", (data) => {
  console.table(onAirObject);
  console.table(onAir);

  let names = data.map((item) => item.raw.channel.english_name);
  console.group("Check End Stream");
  let result = Object.keys(onAirObject).filter(function (item) {
    console.log(item, names.indexOf(item) === -1);
    return names.indexOf(item) === -1;
  });
  console.groupEnd();

  if (result.length > 0) {
    for (var i = 0; i < result.length; i++) {
      let index = onAirObject[result[i]];
      console.log(index + " is now deleting..");
      // 방송 종료, 삭제
      removeInterval(index);
      live.querySelector("#profile_artile_" + index).remove();
      document.getElementById("live_info_" + index).innerHTML = "";
      document.getElementById("live_info_" + index).style.display = "none";
      onAir.splice(onAir.indexOf(result[i]), 2);
      delete onAirObject[result[i]];
      console.table(onAir);
      console.table(onAirObject);
      console.log(result[i] + "is ended ");
    }
  }
  //console.group("Check Live Stream");
  for (var i = 0; i < data.length; i++) {
    if (onAir.indexOf(data[i].raw.channel.english_name) !== -1) {
      // 방송 중, 시간 업데이트
      removeInterval(onAirObject[data[i].raw.channel.english_name]);
      let target1 = document.getElementById("live_div_" + onAirObject[data[i].raw.channel.english_name]);
      let target1_child = target1.childNodes;
      let target1_uptime = liveUptime(data[i].raw.start_actual, "real" + onAirObject[data[i].raw.channel.english_name]);
      let target2 = live.querySelector("#c_live_div_" + onAirObject[data[i].raw.channel.english_name]);
      let target2_child = target2.childNodes;
      let target2_uptime = liveUptime(data[i].raw.start_actual, "clone" + onAirObject[data[i].raw.channel.english_name]);
      target1.replaceChild(target1_uptime, target1_child[1]);
      target2.replaceChild(target2_uptime, target2_child[1]);
      if (data[i].raw.topic_id !== "membersonly") {
        target1_child[2].innerHTML = data[i].raw.live_viewers.toLocaleString("en-US") + " watching" + "<br/>";
        target2_child[2].innerHTML = data[i].raw.live_viewers.toLocaleString("en-US") + " watching" + "<br/>";
      }
      isFirstLoad = false;
      //console.log(data[i].raw.channel.english_name + "is updated");
    } else {
      // 방송 ON
      for (var j = 0; j < 54; j++) {
        var target = document.getElementById("name_" + j).innerHTML;
        if (data[i].raw.channel.english_name === target) {
          let live_div = document.createElement("article");
          let uptime = liveUptime(data[i].raw.start_actual, "real" + j);
          var viewer = document.createElement("small");
          var title = document.createElement("span");
          var topic_div = topic(data[i].raw.topic_id);
          live_div.style.margin = 0;
          live_div.setAttribute("id", "live_div_" + j);
          document.getElementById("live_info_" + j).style.display = "block";

          title.innerText = data[i].raw.title;

          if (data[i].raw.topic_id === "membersonly") {
            live_div.setAttribute("data-theme", "light");
          } else {
            viewer.innerHTML = data[i].raw.live_viewers.toLocaleString("en-US") + " watching" + "<br/>";
          }

          live_div.appendChild(title);
          live_div.appendChild(uptime);
          live_div.appendChild(viewer);
          live_div.appendChild(topic_div);
          live_div.style.cursor = "pointer";
          let id = data[i].raw.id;
          live_div.addEventListener("click", () => {
            window.ipcRender.send("live_url:send", id);
          });
          document.getElementById("live_info_" + j).appendChild(live_div);

          let clone = document.getElementById("profile_artile_" + j).cloneNode(true);
          let clone_child = clone.querySelector("#live_info_" + j).childNodes;

          let channel_id = data[i].raw.channel.id;
          clone.querySelector("#name_" + j).addEventListener("click", () => {
            window.ipcRender.send("channel_url:send", channel_id);
          });

          clone.querySelector("#live_info_" + j).removeChild(clone_child[0]);
          let clone_div = live_div.cloneNode(true);
          clone_div.setAttribute("id", "c_live_div_" + j);
          clone_div.addEventListener("click", () => {
            window.ipcRender.send("live_url:send", id);
          });
          let clone_uptime = liveUptime(data[i].raw.start_actual, "clone" + j);
          clone_div.replaceChild(clone_uptime, clone_div.childNodes[1]);
          clone.querySelector("#live_info_" + j).appendChild(clone_div);

          // live.appendChild(clone);
          if (live.firstChild) live.insertBefore(clone, live.firstChild);
          else live.appendChild(clone);
          let liveChild = live.querySelector("#profile_artile_" + j).childNodes;
          live.querySelector("#profile_artile_" + j).removeChild(liveChild[3]);

          onAir.push(data[i].raw.channel.english_name);
          onAir.push(j);
          for (var k = 0; k < onAir.length; k += 2) {
            onAirObject[onAir[k]] = onAir[k + 1];
          }
          console.log(data[i].raw.channel.english_name + "is now OnAir");
          if (!isFirstLoad) sendNotification(data[i]);
        }
      }
    }
  }
  //console.groupEnd();
});

window.ipcRender.receive("scheduled:load", (data) => {
  // 목록 리셋
  for (i = 0; i < 54; i++) {
    // removeFooter(document.getElementById("profile_artile_" + i));
    document.getElementById("scheduled_info_" + i).innerHTML = "";
    document.getElementById("scheduled_info_" + i).style.display = "none";
  }

  for (i = 0; i < data.length; i++) {
    for (j = 0; j < 54; j++) {
      if (data[i].raw.channel.english_name === document.getElementById("name_" + j).innerHTML) {
        let scheduled_div = document.createElement("article");
        var title = document.createElement("span");
        var schedule = scheduletime(data[i].raw.start_scheduled);
        var topic_div = topic(data[i].raw.topic_id);
        document.getElementById("scheduled_info_" + j).style.display = "block";

        scheduled_div.style.margin = 0;
        title.setAttribute("id", "s_title_" + j);
        title.innerText = data[i].raw.title;
        if (data[i].raw.topic_id === "membersonly") {
          scheduled_div.setAttribute("data-theme", "light");
        }

        scheduled_div.appendChild(title);
        scheduled_div.appendChild(schedule);
        scheduled_div.appendChild(topic_div);
        scheduled_div.style.cursor = "pointer";
        let id = data[i].raw.id;
        scheduled_div.addEventListener("click", (evt) => {
          window.ipcRender.send("live_url:send", id);
          // console.log(id)
        });

        //if (document.getElementById("scheduled_info_" + j).firstChild) scheduled_div.style.marginTop = "20px";
        document.getElementById("scheduled_info_" + j).appendChild(scheduled_div);
      }
    }
  }
});

function liveUptime(value, id) {
  // console.log(interval);
  var uptimeDiv = document.createElement("div");
  uptimeDiv.setAttribute("id", "uptime");
  if (value) {
    uptimeDiv.innerHTML = '<span style = "color:#FF0000">' + "--" + " : " + "--" + " : " + "--" + "</span>";
    let current_time;
    let start_actual;
    let uptimeDate;
    // if (!(id in interval)) {
    interval[id] = setInterval(() => {
      // setInterval(() => {
      current_time = new Date();
      start_actual = new Date(value);
      uptimeDate = new Date(current_time - start_actual);

      uptimeDiv.innerHTML =
        '<span style = "color:rgba(255, 60, 60);">' +
        String(uptimeDate.getUTCHours()).padStart(2, "0") +
        " : " +
        String(uptimeDate.getUTCMinutes()).padStart(2, "0") +
        " : " +
        String(uptimeDate.getUTCSeconds()).padStart(2, "0") +
        "</span>";
    }, 1000);
    // }
  } else uptimeDiv.innerHTML = '<small style = "color:#FF0000">' + "Waiting for Stream..." + "</small>";
  // document.getElementById(parent).appendChild(uptimeDiv);
  return uptimeDiv;
}

const details = document.querySelectorAll("details");

// details.forEach((targetDetail) => {
//   targetDetail.addEventListener("click", () => {
//     // Close all the details that are not targetDetail.
//     details.forEach((detail) => {
//       if (detail !== targetDetail) {
//         detail.removeAttribute("open");
//       }
//     });
//   });
// });

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
  if (reload.states === "scrollUp") scrollUp();
  else {
    details.forEach((detail) => {
      detail.removeAttribute("open");
    });
  }
});

alarm.addEventListener("click", (evt) => {
  if (alarm.states === "on") {
    alarm.states = "off";
  } else {
    alarm.states = "on";
  }
  changeAlarm(alarm.states)
  let obj = new Object();
  obj.alarm = alarm.states;
  window.ipcRender.send("setting:save", obj);
});

function changeAlarm(state) {
  if (state === "on") {
    alarm.innerText = "🔔";
  } else {
    alarm.innerText = "🔕";
  }
}

async function scrollUp() {
  const c = document.documentElement.scrollTop || document.body.scrollTop;
  if (c > 0) {
    window.requestAnimationFrame(scrollUp);
    window.scrollTo(0, c - c / 8);
  }
}

async function sendNotification(data) {
  if (alarm.states === "on") {
    var blob = await fetch(data.raw.channel.photo).then((r) => r.blob());
    let dataUrl = await new Promise((resolve) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    // return dataUrl;
    var content = { name: data.raw.channel.english_name, title: data.raw.title, photo: dataUrl, id: data.raw.id };
    window.ipcRender.send("notification:send", content);
  }
}

function scheduletime(value) {
  var scheduledDiv = document.createElement("div");
  var scheduled = new Date(value);
  scheduledDiv.innerHTML =
    "<small><b>" +
    String(scheduled.getFullYear()).substr(-2) +
    ". " +
    String(scheduled.getMonth() + 1) +
    ". " +
    String(scheduled.getDate()) +
    ". " +
    String(scheduled.getHours()).padStart(2, "0") +
    " : " +
    String(scheduled.getMinutes()).padStart(2, "0") +
    "</b></small>";
  // document.getElementById(parent).appendChild(scheduledDiv);
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
  // document.getElementById(parent).appendChild(topicDiv);
}

function removeAllChildNodes(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.lastChild);
  }
}

function removeFooter(parent) {
  if (parent.children.length > 2) {
    for (k = 2; k < parent.children.length; k++) {
      parent.removeChild(parent.children[k]);
      k--;
    }
  }
  return false;
}

function changeTheme(target) {
  document.getElementById("body").style.backgroundImage = "url(./img/background/" + target + ".png)";
  // document.getElementsByClassName("live_btn")[0].setAttribute("theme", target);
  document.getElementById("body").setAttribute("theme", target);
}

function removeInterval(index) {
  clearInterval(interval["real" + index]);
  clearInterval(interval["clone" + index]);
}
