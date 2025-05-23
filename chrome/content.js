const COLORS = {
  GREEN: '#00b06f',
  BLUE: '#0077ff',
  RED: '#ff3e3e',
};

const { getURL } = chrome.runtime;

const USER = {
  SUCCESS: getURL('images/user-success.png'),
  NEUTRAL: getURL('images/user.png'),
  ERROR: getURL('images/user-error.png'),
};

const sleep = time => new Promise(res => setTimeout(res, time * 1000));

const get = async (url) => {
  try {
    const request = await fetch(`https://${url}`);
    if (!request.ok) throw new Error('Request failed');

    return await request.json();
  } catch (error) {
    await sleep(0.4);
    return await get(url);
  }
};

async function getUserFromUsername(username) {
  const response = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });

  const data = await response.json();
  return data.data && data.data.length > 0 ? data.data[0] : null;
}

const post = async (url, body) => {
  try {
    const request = await fetch(`https://${url}`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!request.ok) throw new Error('Request failed');

    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await post(url, body);
  }
};

const search = document.getElementById('rbxt-search');
const input = document.getElementById('rbxt-input');
const status = document.getElementById('rbxt-status');
const icon = document.getElementById('rbxt-user');
const bar = document.getElementById('rbxt-bar');

search.src = getURL('images/search.png');
icon.src = getURL('images/user.png');

const color = hex => {
  bar.style.backgroundColor = hex;
  search.style.backgroundColor = hex;
};

input.oninput = () => {
  const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(input.value);
  if (!input.value) icon.src = USER.NEUTRAL;
  else icon.src = test ? USER.SUCCESS : USER.ERROR;
  search.disabled = !test;
};

let searching = false;
let canceled = false;
let foundAllServers = false;
let searchingTarget = true;
let allPlayers = [];
let playersCount = 0;
let targetsChecked = 0;
let maxPlayers = 0;

let targetServersId = [];
let highlighted = [];

const allThumbnails = new Map();

async function fetchServers(place = '', cursor = '', attempts = 0) {
  const { nextPageCursor, data } = await get(`games.roblox.com/v1/games/${place}/servers/Public?limit=100&cursor=${cursor}`);

  if (attempts >= 30) {
    foundAllServers = true;
    return;
  }

  if (!data || data.length === 0) {
    await sleep(1);
    return fetchServers(place, cursor, attempts + 1);
  }

  data.forEach((server) => {
    server.playerTokens.forEach((playerToken) => {
      playersCount += 1;
      allPlayers.push({
        token: playerToken,
        type: 'AvatarHeadshot',
        size: '150x150',
        requestId: server.id,
      });
    });

    maxPlayers = server.maxPlayers;
  });

  if (!nextPageCursor || canceled) {
    foundAllServers = true;
    return;
  }

  await sleep(1);
  return fetchServers(place, nextPageCursor);
}

async function findTarget(imageUrl, place) {
  while (searchingTarget) {
    if (canceled) {
      searchingTarget = false;
    }

    const chosenPlayers = [];

    for (let i = 0; i < 100; i++) {
      const playerToken = allPlayers.shift();
      if (!playerToken) break;
      chosenPlayers.push(playerToken);
    }

    if (!chosenPlayers.length) {
      await sleep(0.1);
      if (targetsChecked === playersCount && foundAllServers) {
        break;
      }
      continue;
    }

    post('thumbnails.roblox.com/v1/batch', JSON.stringify(chosenPlayers)).then(({ data: thumbnailsData }) => {
      if (canceled) return;

      thumbnailsData.forEach((thumbnailData) => {
        const thumbnails = allThumbnails.get(thumbnailData.requestId) || [];

        if (thumbnails.length == 0) {
          allThumbnails.set(thumbnailData.requestId, thumbnails);
        }

        targetsChecked += 1;

        if (!thumbnails.includes(thumbnailData.imageUrl)) {
          thumbnails.push(thumbnailData.imageUrl);
        }

        bar.style.width = `${Math.round((targetsChecked / playersCount) * 100)}%`;

        const foundTarget = thumbnailData.imageUrl === imageUrl ? thumbnailData.requestId : null;

        if (foundTarget) {
          renderServers();

          targetServersId.push(foundTarget);
          searchingTarget = false;
        }
      });
    });
  }

  if (targetServersId.length) {
    targetServersId.forEach((targetServerId) => {
      icon.src = getURL('images/user-success.png');
      color(COLORS.GREEN);
      setTimeout(() => color(COLORS.BLUE), 1000);
  
      const first = document.querySelectorAll('#rbxt-panel')[0]

      const item = document.createElement('div');
  
      const thumbnails = allThumbnails.get(targetServerId);
  
      item.className = 'stack-row rbx-game-server-item highlighted';
      item.innerHTML = `
        <div class="section-left rbx-game-server-details" style="transform: translateY(10px);">
        <div class="text-info rbx-game-status rbx-game-server-status'">${thumbnails.length} of ${maxPlayers} people max</div>
        <span>
        <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join btn-primary-md btn-min-width">Join</button>
        </span>
        </div>
        <div class="section-right rbx-game-server-players" style="transform: translateY(10px);">
        ${thumbnails.map(url => `<span class="avatar avatar-headshot-sm player-avatar"><span class="thumbnail-2d-container avatar-card-image"><img src="${url}"></span></span>`).join('')}
        </div>`;
      item.style.marginTop = '60px';
      item.style.marginBottom = '30px';
  
      first.parentNode.insertBefore(item, first.nextSibling);
      highlighted.push(item);

      const br = document.createElement('br');
      first.parentNode.insertBefore(br, item.nextSibling);
  
      const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
      join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
      status.innerText = 'Found target';
    });
  } else {
    color(canceled ? COLORS.BLUE : COLORS.RED);
    status.innerText = canceled ? 'Canceled search' : 'Target not found!';
  }

  searching = false;
  canceled = false;

  bar.style.width = '100%';
  input.disabled = false;
  search.src = getURL('images/search.png');
}

function renderServers() {
  highlighted.forEach((item) => {
    item.remove();    
  });

  highlighted = [];

  targetServersId.forEach((targetServerId) => {
    icon.src = getURL('images/user-success.png');
    color(COLORS.GREEN);
    setTimeout(() => color(COLORS.BLUE), 1000);

    const first = document.querySelectorAll('.rbx-game-server-item')[0];
    const item = document.createElement('li');

    const thumbnails = allThumbnails.get(targetServerId);

    item.className = 'stack-row rbx-game-server-item highlighted';
    item.innerHTML = `
      <div class="section-left rbx-game-server-details'">
      <div class="text-info rbx-game-status rbx-game-server-status'">${thumbnails.length} of ${maxPlayers} people max</div>
      <span>
      <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join btn-primary-md btn-min-width">Join</button>
      </span>
      </div>
      <div class="section-right rbx-game-server-players">
      ${thumbnails.map(url => `<span class="avatar avatar-headshot-sm player-avatar"><span class="thumbnail-2d-container avatar-card-image"><img src="${url}"></span></span>`).join('')}
      </div>`;

    first.parentNode.insertBefore(item, first);
    highlighted.push(item);

    const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
    join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
    status.innerText = 'Found target';
  });
};

async function find(imageUrl, place) {
  allPlayers = [];
  targetServersId = [];

  allThumbnails.clear();
  foundAllServers = false;
  searchingTarget = true;
  allPlayers = [];
  playersCount = 0;
  targetsChecked = 0;
  maxPlayers = 0;

  status.innerText = 'Searching...';
  color(COLORS.BLUE);
  search.src = getURL('images/cancel.png');
  icon.src = getURL('images/user-success.png');
  input.disabled = true;

  fetchServers(place);
  findTarget(imageUrl, place);
}

search.addEventListener('click', async event => {
  // Prevents page from refreshing
  event.preventDefault();

  if (searching) {
    canceled = true;
    return;
  }

  searching = true;

  const inputValue = input.value;
  let user = null;

  if (/^\d+$/.test(inputValue)) { // Input is a user id
    const res = await fetch(`https://users.roblox.com/v1/users/${inputValue}`);
    user = await res.json();
  } else { // Input is a username
    user = await getUserFromUsername(inputValue);
  }

  if (!user) {
    icon.src = USER.ERROR;
    searching = false;
    status.innerText = 'User not found!';
    console.error("User not found!");
    return;
  }

  const [, place] = window.location.href.match(/games\/(\d+)\//);
  const { data: [{ imageUrl }] } = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);

  // Debugging
  console.log(user);
  console.log(imageUrl);

  highlighted.forEach((item) => {
    item.remove();
  });

  find(imageUrl, place);
});