// list.js - handle the procrastination list

document.addEventListener('DOMContentLoaded', async () => {
  const storageData = await browser.storage.local.get('distractingEntries');
  const distractingEntries = storageData.distractingEntries || [];

  const tableBody = document.querySelector('#distractingTabList tbody');

  if (Array.isArray(distractingEntries)) {
    // Sort entries by most recent timestamp
    distractingEntries.sort((a, b) => b.timestamp - a.timestamp);

    distractingEntries.forEach(entry => {
      const row = tableBody.insertRow();
      const checkboxCell = row.insertCell();
      const titleCell = row.insertCell();
      const timestampCell = row.insertCell();

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkboxCell.appendChild(checkbox);

      const link = document.createElement('a');
      link.href = entry.url;
      link.textContent = entry.title;
      link.style.color = '#3498db';
      link.target = '_blank';
      titleCell.appendChild(link);

      timestampCell.textContent = new Date(entry.timestamp).toLocaleString();
    });
  } else {
    console.error('distractingEntries is not an array:', distractingEntries);
  }

  document.getElementById('addToProcrastinationListBtn').addEventListener('click', () => {
    getCurrentTabInfo().then(tabInfo => {
      saveToProcrastinationList(tabInfo.title, tabInfo.url);
    });
  });

  document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#distractingTabList tbody input[type="checkbox"]');
    const selectedEntries = [];
    checkboxes.forEach((checkbox, index) => {
      if (checkbox.checked) {
        selectedEntries.push(index);
      }
    });

    const updatedEntries = distractingEntries.filter((entry, index) => !selectedEntries.includes(index));
    await browser.storage.local.set({ 'distractingEntries': updatedEntries });
    location.reload(); // Refresh the page to reflect changes
  });

  document.getElementById('deleteAllBtn').addEventListener('click', async () => {
    await browser.storage.local.set({ 'distractingEntries': [] });
    location.reload(); // Refresh the page to reflect changes
  });

});

function getCurrentTabInfo() {
  return browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const currentTab = tabs[0];
    return { title: currentTab.title, url: currentTab.url };
  });
}

async function saveToProcrastinationList(title, url) {
  const entry = { title, url, timestamp: new Date().getTime() };
  const { distractingEntries } = await browser.storage.local.get('distractingEntries');
  const existingEntries = distractingEntries || [];
  existingEntries.push(entry);
  await browser.storage.local.set({ distractingEntries: existingEntries });
  // Reload the table
  reloadTable();
}

function reloadTable() {
  location.reload(); // Refresh the page to reflect changes
}
