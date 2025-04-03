if (!window.RBXTracker_Loaded) {
  window.RBXTracker_Loaded = true;
  
  function waitForElm(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) resolve(document.querySelector(selector));
  
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  (async () => {
    const div = document.createElement('div');
    div.id = 'rbxt-panel';
    div.innerHTML = await fetch(chrome.runtime.getURL('panel.html')).then(res => res.text());
    if (document.body.classList.contains('dark-theme')) div.classList.add('dark');
  
    const linebreak = document.createElement('br');
  
    console.log("DEBUG: 1");
    const runningGames = await waitForElm('running-game-instances-container');
    console.log("DEBUG: 2");

    runningGames.parentNode.insertBefore(div, runningGames);
    runningGames.parentNode.insertBefore(linebreak, runningGames);
  })();
} else {
  console.warn("Tracker already loaded");
}