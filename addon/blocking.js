// blocking.js - Script for the blocking page
document.addEventListener("DOMContentLoaded", function () {
    let currentRating = null;
    let blockType = 'tab';
    let currentUrl = '';
    let currentDomain = '';
    let currentTitle = '';
    
    const disableBlockingBtn = document.getElementById("disableBlockingBtn");
    const tabToggleBtn = document.getElementById("tabToggleBtn");
    const domainToggleBtn = document.getElementById("domainToggleBtn");
    const currentUrlDisplay = document.getElementById("currentUrl");
    const blockedTabTitleDisplay = document.getElementById("blockedTabTitle");
    
    initializeDisableButtonCounter();
    loadBlockedTabInfo();
    
    // Handle tab/domain toggle
    tabToggleBtn.addEventListener("click", () => {
        blockType = 'tab';
        updateToggleButtons();
    });
    
    domainToggleBtn.addEventListener("click", () => {
        blockType = 'domain';
        updateToggleButtons();
    });
    
    // Handle always block button
    document.getElementById("alwaysBlockBtn").addEventListener("click", () => {
        // Determine what to block based on the toggle selection
        const urlToBlock = blockType === 'tab' ? currentUrl : currentDomain;
        
        browser.storage.local.get("alwaysBlockUrls").then((result) => {
            const alwaysBlockUrls = result.alwaysBlockUrls || [];
            if (!alwaysBlockUrls.includes(urlToBlock) && urlToBlock !== "" && urlToBlock !== "none") {
                alwaysBlockUrls.push(urlToBlock);
                browser.storage.local.set({ alwaysBlockUrls: alwaysBlockUrls });
            }
            
            // Save the current rating if one is selected
            saveCurrentRating();

            browser.runtime.sendMessage({ type: "closeBlockedTab" });
        });
    });

    // Handle never block button
    document.getElementById("neverBlockBtn").addEventListener("click", () => {
        // Determine what to allow based on the toggle selection
        const urlToAllow = blockType === 'tab' ? currentUrl : currentDomain;
        
        browser.storage.local.get("neverBlockUrls").then((result) => {
            const neverBlockUrls = result.neverBlockUrls || [];
            if (!neverBlockUrls.includes(urlToAllow ) && urlToAllow !== "" && urlToAllow !== "none") {
                neverBlockUrls.push(urlToAllow);
                browser.storage.local.set({ neverBlockUrls: neverBlockUrls });
            }
            
            // Save the current rating if one is selected
            saveCurrentRating();
            
            browser.runtime.sendMessage({ type: "restoreBlockedTab" });
        });
    });

    // Handle disable blocking button
    disableBlockingBtn.addEventListener("click", () => {
        updateDisableButtonUseCount();
        
        browser.storage.local.set({ blockingTimeout: Date.now() + 10 * 60 * 1000 }).then(() => {
            saveCurrentRating();
            
            browser.runtime.sendMessage({ type: "restoreBlockedTab" })
        });
    });

    document.getElementById("accurateRatingBtn").addEventListener("click", () => {
        if (currentRating === 'positive') {
            // Deselect if already selected
            currentRating = null;
            updateButtonVisuals();
        } else {
            currentRating = 'positive';
            updateButtonVisuals();
        }
    });

    document.getElementById("inaccurateRatingBtn").addEventListener("click", () => {
        if (currentRating === 'negative') {
            // Deselect if already selected
            currentRating = null;
            updateButtonVisuals();
        } else {
            currentRating = 'negative';
            updateButtonVisuals();
        }
    });
    
    // Function to load the blocked URL and title
    function loadBlockedTabInfo() {
        browser.storage.local.get("blockedTabTemp").then((result) => {
            if (result.blockedTabTemp) {
                currentUrl = result.blockedTabTemp.url;
                currentTitle = result.blockedTabTemp.title;
                
                // Extract the domain from the URL
                try {
                    const url = new URL(currentUrl);
                    currentDomain = url.hostname;
                } catch (e) {
                    currentDomain = currentUrl; // Fallback if URL parsing fails
                }
                
                updateUrlDisplay();
                
            }
        });
    }
    
    // Function to update the toggle buttons based on the current selection
    function updateToggleButtons() {
        tabToggleBtn.classList.toggle("active", blockType === 'tab');
        domainToggleBtn.classList.toggle("active", blockType === 'domain');
        updateUrlDisplay();
    }
    
    // Function to update the displayed URL based on the toggle selection
    function updateUrlDisplay() {
        const displayUrl = blockType === 'tab' ? currentUrl : currentDomain;
        browser.storage.local.get(["tabTitlesPenalized", "tabTitlesPreserve"]).then((result) => {
            //if the current title is already in the penalized list, show that in the message
            blockedTabTitleDisplay.textContent = "Tab title: " + (currentTitle || "");
            if (result.tabTitlesPenalized && result.tabTitlesPenalized.includes(currentTitle)) {
                blockedTabTitleDisplay.innerHTML += "<br><span style='color: red; font-weight: bold;'>(previously marked as distracting)</span>";
            }
            if (result.tabTitlesPreserve && result.tabTitlesPreserve.includes(currentTitle)) {
                blockedTabTitleDisplay.innerHTML += "<br><span style='color: red; font-weight: bold;'>(previously marked as relevant)</span>";
            }
        });

        currentUrlDisplay.textContent = displayUrl.length > 100 ? displayUrl.slice(0, 100) + "..." : displayUrl;
    }
    
    // Function to initialize the disable button counter
    function initializeDisableButtonCounter() {
        const today = new Date().toLocaleDateString();
        
        browser.storage.local.get("disableButtonUses").then((result) => {
            const disableButtonUses = result.disableButtonUses || {};
            
            // If there's no entry for today or it's a different day, reset the counter
            if (!disableButtonUses.date || disableButtonUses.date !== today) {
                disableButtonUses.date = today;
                disableButtonUses.count = 0;
                browser.storage.local.set({ disableButtonUses: disableButtonUses });
            }
            
            updateDisableButtonText(disableButtonUses.count);
        });
    }
    
    // Function to update the disable button use count
    function updateDisableButtonUseCount() {
        const today = new Date().toLocaleDateString();
        
        browser.storage.local.get("disableButtonUses").then((result) => {
            const disableButtonUses = result.disableButtonUses || { date: today, count: 0 };
            
            // Reset counter if it's a new day
            if (disableButtonUses.date !== today) {
                disableButtonUses.date = today;
                disableButtonUses.count = 0;
            }
            
            disableButtonUses.count++;
            
            browser.storage.local.set({ disableButtonUses: disableButtonUses });
            
            updateDisableButtonText(disableButtonUses.count);
        });
    }
    
    // Function to update the disable button text with the current count
    function updateDisableButtonText(count) {
        disableBlockingBtn.innerHTML = `<strong>Return</strong> and disable blocking for 10 minutes<br>(You selected this option <strong>${count}</strong> times today)`;
    }
    
    // Function to update button visuals based on current selection
    function updateButtonVisuals() {
        // Reset both buttons to default state
        document.getElementById("accurateRatingBtn").classList.remove("active");
        document.getElementById("inaccurateRatingBtn").classList.remove("active");
        document.getElementById("accurateRatingBtn").style.opacity = "1";
        document.getElementById("inaccurateRatingBtn").style.opacity = "1";
        
        // Apply styling based on current selection
        if (currentRating === 'positive') {
            document.getElementById("accurateRatingBtn").classList.add("active");
            document.getElementById("inaccurateRatingBtn").style.opacity = "0.5";
        } else if (currentRating === 'negative') {
            document.getElementById("inaccurateRatingBtn").classList.add("active");
            document.getElementById("accurateRatingBtn").style.opacity = "0.5";
        }
    }
    
    // Function to save the current rating when closing the page
    function saveCurrentRating() {
        if (!currentRating) return; // No rating selected
        
        browser.storage.local.get(["blockedTabTemp", "tabTitlesPenalized", "tabTitlesPreserve"]).then((result) => {
            const tabTitlesPenalized = result.tabTitlesPenalized || [];
            const tabTitlesPreserve = result.tabTitlesPreserve || [];
            
            if (!currentTitle || currentTitle === "none" || currentTitle === "") return; // No URL to save rating for
            if (currentRating === 'positive') {
                // Remove from negative ratings if present
                const negIndex = tabTitlesPreserve.indexOf(currentTitle);
                if (negIndex !== -1) {
                    tabTitlesPreserve.splice(negIndex, 1);
                }
                
                // Add to positive ratings if not already there
                if (!tabTitlesPenalized.includes(currentTitle)) {
                    tabTitlesPenalized.push(currentTitle);
                }
                
                browser.storage.local.set({ 
                    tabTitlesPenalized: tabTitlesPenalized, 
                    tabTitlesPreserve: tabTitlesPreserve 
                }).then(() => {
                    browser.runtime.sendMessage({ type: "updateUserInfo" });
                });
            } else if (currentRating === 'negative') {
                // Remove from positive ratings if present
                const posIndex = tabTitlesPenalized.indexOf(currentTitle);
                if (posIndex !== -1) {
                    tabTitlesPenalized.splice(posIndex, 1);
                }
                
                // Add to negative ratings if not already there
                if (!tabTitlesPreserve.includes(currentTitle)) {
                    tabTitlesPreserve.push(currentTitle);
                }
                
                browser.storage.local.set({ 
                    tabTitlesPenalized: tabTitlesPenalized, 
                    tabTitlesPreserve: tabTitlesPreserve 
                }).then(() => {
                    browser.runtime.sendMessage({ type: "updateUserInfo" });
                });
            }
        });
    }
    
    // Save rating when the page is about to unload
    window.addEventListener('beforeunload', function() {
        saveCurrentRating();
    });
});