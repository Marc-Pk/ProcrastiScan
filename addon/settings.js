document.addEventListener("DOMContentLoaded", function () {

  function checkThemeAvailability() {
    if (!browser.theme) {
      document.getElementById("nudgingOption").checked = false;
      document.getElementById("nudgingOption").disabled = true;
      document.querySelector('label[for="nudgingOption"]').title = "This feature is only available in Firefox";
    }
  }

  function saveSettings() {
    const availableInterventions = {
      none: document.getElementById("noInterventionOption").checked,
      nudging: document.getElementById("nudgingOption").checked,
      blocking: document.getElementById("blockingOption").checked,
      chatbot: document.getElementById("chatbotOption").checked,
      procrastinationList: document.getElementById("procrastinationListOption").checked,
    };

    const llmPort = document.getElementById("llmPort").value;
    const blockingTimeRanges = document.getElementById("blockingTimeRanges").value;

    const interventionTimes = {};
    document.querySelector("#dayOfWeekCheckboxes").querySelectorAll(".form-check-input[type=checkbox]").forEach(checkbox => {
      if (checkbox.checked) {
        interventionTimes[checkbox.value] = blockingTimeRanges;
      }
    });

    const settings = {
      availableInterventions: availableInterventions,
      llmPort: llmPort,
      interventionTimes: interventionTimes
    };

    browser.storage.local.set({ settings: settings });
  }

  function loadSettings() {
    browser.storage.local.get("settings").then((data) => {
      if (data.settings) {
        const { availableInterventions, llmPort, interventionTimes } = data.settings;
        document.getElementById("noInterventionOption").checked = availableInterventions.none || false;
        document.getElementById("nudgingOption").checked = availableInterventions.nudging || false;
        document.getElementById("blockingOption").checked = availableInterventions.blocking || false;
        document.getElementById("chatbotOption").checked = availableInterventions.chatbot || false;
        document.getElementById("procrastinationListOption").checked = availableInterventions.procrastinationList || false;
        document.getElementById("llmPort").value = llmPort || "";
        document.getElementById("blockingTimeRanges").value = interventionTimes["Monday"] || "";

        document.querySelector("#dayOfWeekCheckboxes").querySelectorAll(".form-check-input[type=checkbox]").forEach(checkbox => {
          checkbox.checked = interventionTimes[checkbox.value] ? true : false;
        });
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
  document.getElementById("noInterventionOption").addEventListener("change", saveSettings);
  // ask the user to confirm the risk of data loss, revert to none if they don't confirm
  document.getElementById("blockingOption").addEventListener("change", function (event) {
    if (event.target.checked) {
      const userConfirmed = confirm("WARNING: Important tabs like booking processes, chats, or LLM providers might be accidentally blocked when using this intervention, leading to data loss. It can also happen that such pages can be accessed at first but are blocked after switching to the tab later, in case your Focus Score drops below 0.5 meanwhile. Add frequently used important domains to the allow list either on the blocking page or the Filters tab");
      if (userConfirmed) {
      saveSettings();
      } else {
      //set to none
      document.getElementById("blockingOption").checked = false;
      document.getElementById("noInterventionOption").checked = true; 
      saveSettings();
      }
    }
  });
  document.getElementById("chatbotOption").addEventListener("change", saveSettings);
  document.getElementById("procrastinationListOption").addEventListener("change", saveSettings);
  document.getElementById("llmPort").addEventListener("input", saveSettings);
  document.getElementById("blockingTimeRanges").addEventListener("input", saveSettings);
  document.querySelectorAll(".form-check-input[type=checkbox]").forEach(checkbox => {
    checkbox.addEventListener("change", saveSettings);
  });

  loadSettings();
  checkThemeAvailability();
  setInterval(checkLLMConnection, 1000);
  setInterval(checkPythonServerConnection, 1000);
});
