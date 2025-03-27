// filters.js - Manages lists of blocked/incentivized tabs and titles
document.addEventListener("DOMContentLoaded", function () {
    // Set up the tabs of the lists
    console.log("Setting up the lists tab");
    const container = document.getElementById("lists-container");
    const tabs = container.querySelectorAll(".nav-link");
    const tabContents = container.querySelectorAll(".tab-pane");

    tabs.forEach(tab => {
        tab.addEventListener("click", function (event) {
            event.preventDefault();

            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("show", "active"));
            this.classList.add("active");

            const target = container.querySelector(this.getAttribute("href"));
            target.classList.add("show", "active");
        });
    });

    // Event listener for the save button
    document.getElementById("saveBtn").addEventListener("click", saveAllLists);

    loadLists();
});

// Load each list from storage and populate the corresponding container
function loadLists() {
    const lists = [
        { id: "blockedList", storageKey: "alwaysBlockUrls" },
        { id: "allowedList", storageKey: "neverBlockUrls" },
        { id: "penalizedList", storageKey: "tabTitlesPenalized" },
        { id: "preservedList", storageKey: "tabTitlesPreserve" }
    ];

    lists.forEach(({ id, storageKey }) => {
        browser.storage.local.get(storageKey).then(data => {
            const listContainer = document.getElementById(id);
            listContainer.innerHTML = (data[storageKey] || [])
                .map(item => `<div>${item}</div>`)
                .join("");
        });
    });
}

// Save all lists to storage when the save button is clicked
function saveAllLists() {
    const lists = [
        { id: "blockedList", storageKey: "alwaysBlockUrls" },
        { id: "allowedList", storageKey: "neverBlockUrls" },
        { id: "penalizedList", storageKey: "tabTitlesPenalized" },
        { id: "preservedList", storageKey: "tabTitlesPreserve" }
    ];

    lists.forEach(({ id, storageKey }) => {
        const listContainer = document.getElementById(id);
        const items = Array.from(listContainer.children)
            .map(item => item.innerText.trim())
            .filter(item => item !== "");  // Remove empty entries

        browser.storage.local.set({ [storageKey]: items });
    });
    browser.runtime.sendMessage({ type: "updateUserInfo" });
}
