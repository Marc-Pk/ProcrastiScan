document.addEventListener("DOMContentLoaded", function () {

  // Function to check if browser.theme is available
  function checkThemeAvailability() {
    if (!browser.theme) {
      document.getElementById("nudgingOption").checked = false;
      document.getElementById("nudgingOption").disabled = true;
      document.querySelector('label[for="nudgingOption"]').title = "This feature is only available in Firefox";
    }
  }

  // Function to save settings to browser storage
  function saveSettings() {
    const availableInterventions = {
      nudging: document.getElementById("nudgingOption").checked,
      chatbot: document.getElementById("chatbotOption").checked,
      procrastinationList: document.getElementById("procrastinationListOption").checked,
    };

    const llmPort = document.getElementById("llmPort").value;

    const settings = {
      availableInterventions: availableInterventions,
      llmPort: llmPort,
    };

    browser.storage.local.set({ settings: settings }).then(() => {
    });
  }

  // Function to load settings from browser storage
  function loadSettings() {
    browser.storage.local.get("settings").then((data) => {
      if (data.settings) {
        const { availableInterventions, llmPort } = data.settings;

        document.getElementById("nudgingOption").checked = availableInterventions.nudging || false;
        document.getElementById("chatbotOption").checked = availableInterventions.chatbot || false;
        document.getElementById("procrastinationListOption").checked = availableInterventions.procrastinationList || false;
        document.getElementById("llmPort").value = llmPort || "";

        console.log("Settings loaded");
      }
    });
  }

  let lastLLMStatus = null;

  // Function to check LLM connection status
  function checkLLMConnection() {
    const llmPort = document.getElementById("llmPort").value;

    fetch(`http://localhost:${llmPort}/status`)
      .then(response => {
        const newStatus = response.ok ? 'connected' : 'disconnected';
        if (newStatus !== lastLLMStatus) {
          updateLLMStatus(newStatus);
        }
        lastLLMStatus = newStatus;
      })
      .catch(() => {
        if (lastLLMStatus !== 'error') {
          updateLLMStatus('error');
        }
        lastLLMStatus = 'error';
      });
  }

  // Function to update LLM connection status
  function updateLLMStatus(status) {
    document.getElementById("llmConnected").style.display = status === 'connected' ? "inline" : "none";
    document.getElementById("llmDisconnected").style.display = status === 'disconnected' || status === 'error' ? "inline" : "none";
    document.getElementById("llmFetching").style.display = "none";
    document.getElementById("chatbotWarning").style.display = status === 'connected' ? "none" : "inline";
    document.getElementById("chatbotWarning").title = status === 'error' ? 
      "Failed to check LLM connection status." : 
      "LLM is disconnected. Chatbot intervention may not function properly.";
  }
  
  let lastPythonServerStatus = null;

  // Function to check Python server connection status
  function checkPythonServerConnection() {
    browser.storage.local.get("websocketConnected").then((data) => {
      const newStatus = data.websocketConnected ? 'connected' : 'disconnected';
      if (newStatus !== lastPythonServerStatus) {
        updatePythonServerStatus(newStatus);
      }
      lastPythonServerStatus = newStatus;
    });
  }

  // Function to update Python server connection status
  function updatePythonServerStatus(status) {
    document.getElementById("pythonServerConnected").style.display = status === 'connected' ? "inline" : "none";
    document.getElementById("pythonServerDisconnected").style.display = status === 'disconnected' ? "inline" : "none";
    document.getElementById("pythonServerFetching").style.display = "none";
  }

  // Add event listeners to save settings on change
  document.getElementById("nudgingOption").addEventListener("change", saveSettings);
  document.getElementById("chatbotOption").addEventListener("change", saveSettings);
  document.getElementById("NoInterventionOption").addEventListener("change", saveSettings);
  document.getElementById("procrastinationListOption").addEventListener("change", saveSettings);
  document.getElementById("llmPort").addEventListener("input", saveSettings);

  // Load settings when the page is loaded
  loadSettings();

  // Check if browser.theme is available
  checkThemeAvailability();

  // Check connection statuses every second
  setInterval(checkLLMConnection, 1000);
  setInterval(checkPythonServerConnection, 1000);
});
