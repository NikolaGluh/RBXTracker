chrome.tabs.onUpdated.addListener((tabId, changeInfo, { url }) => {
  console.log(1);
  if (changeInfo.status !== 'complete' || !/https:\/\/.+roblox.com\/games/g.test(url)) return;
  console.log(2);
  const target = { tabId };

  // Checks if the panel is already injected into the DOM, and if not execute our scripts.
  chrome.scripting.executeScript({ target, func: () => Boolean(document.getElementById('rbxt-panel')) }, async ([{ result }]) => {
    if (result) return;

    await chrome.scripting.insertCSS({ target, files: ['styles.css'] });

    await chrome.scripting.executeScript({ target, files: ['load.js'] });
    chrome.scripting.executeScript({ target, files: ['content.js'] });
  });
});

const func = (place, id) => window.Roblox.GameLauncher.joinGameInstance(place, id);
chrome.runtime.onMessage.addListener(({ message }, { tab }) => chrome.scripting.executeScript(
  {
    target: { tabId: tab.id }, func, args: [message.place, message.id], world: 'MAIN',
  },
));