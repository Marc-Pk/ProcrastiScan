# ProcrastiScan
Downloads:

[Firefox](https://addons.mozilla.org/en-US/firefox/addon/procrastiscan/) | [Chrome, MS Edge, Opera](https://chromewebstore.google.com/detail/procrastiscan/pjieainhjbcopkledhjjlnajfelblpnp)

[Extension Server](https://github.com/Marc-Pk/ProcrastiScan/releases)

ProcrastiScan helps you stay focused and productive by continually checking if the content you're viewing aligns with what you actually want to be doing. 

As you browse, a task-relevance score (**"similarity rating"**) is calculated for every tab, based on the content you're viewing and a specified task. The higher the score, the more relevant the content is to your task. An averaged score (**"mean rating"**) is calculated to reflect your current level of focus. If it falls below 0.5, the extension considers you to be distracted and intervenes according to the settings.


# Table of Contents
* [Features](#features)
* [Quick Setup](#quick-setup)
* [Advanced Setup](#advanced-setup)
  * [Extension Server](#how-to-set-up-the-extension-server)
  * [LLM Server](#how-to-set-up-the-llm-server)
* [Privacy Information](#privacy-information)
* [FAQ](#faq)


# Features
- **LLM-assisted Conversation**: Engage in a focused conversation with an AI assistant to get back on track or reflect on why you got distracted. Requires a LLM connection.

- **Identify Distracting Tabs**: Automatically identify tabs that are likely unrelated to your current task and decide whether to close them or save them for later.

- **Theme Nudging (Firefox only)**: Your browser toolbar will be colored in a bright red tone if you get distracted to increase your mindfulness.

- **Dashboard**: View your similarity score history and see when you were most focused or distracted. 

# Quick Setup

After installing the extension, the "Settings" page should open. Select the features you want and then open the "Overview" tab to provide details about your current task, related content, and common distractions. When you're done, click "Save Settings".

You can access the extension's interface by clicking the icon in your browser's toolbar. From there, you can update your task and related/distracting content information, interact with the procrastination list, engage in a focused conversation with the AI assistant or view your score history. For quick access, it is recommended to pin the extension icon to your browser's toolbar.
# Advanced Setup

You can extend ProcrastiScan in two optional ways:

- score all programs instead of just browser tabs -> set up the **extension server**
- chatbot intervention -> set up a **LLM server**

**If you restart your computer at any point instead of waking it up from sleep, you will need to restart both servers.**

### How to set up the extension server:
#### Option 1, no Python required: 
1. Download the procrastiscan-server-v2.0.0.exe file [here](https://github.com/Marc-Pk/ProcrastiScan/releases).
2. Launch the server by double-clicking the .exe file. Your anti-virus software might flag the file - if you're concerned about security, you can use the Python method described below instead and check the source code of the `procrastiscan-server.py` file.

#### Option 2, using Python:
1. Install Python if you don't have it already.
2. Clone this repository or download the `procrastiscan-server.py` and `requirements.txt` files.
3. Right-click while holding the Shift key inside the installation folder and select "Open in Terminal".
4. Install the required Python dependencies by running `pip install -r requirements.txt`.
5. Launch the server script by executing `python procrastiscan-server.py`. 


### How to set up the LLM server
Install a LLM-server if you don't have one already. Your computer will need to have at least 8GB of RAM available. You can use any OpenAI-like API provider you like to connect to a language model. For example, here are the steps for LMStudio:

1. Download [LMStudio](https://lmstudio.ai/)
2. Launch the program and download a LLM. Llama-3-8B Instruct is recommended.
3. Go to the "Local Server" tab and load the model you downloaded.
4. Under "Configuration", set the server port to 5000 and make sure that "Apply Prompt Formatting" is switched on. If you want to use a different port, open the ProcrastiScan settings tab and change the "LLM Port" value.
5. Click "Start Server" and press the below button.

# Privacy Information

ProcrastiScan works completely offline and does not collect any data.

# FAQ

### Which browsers and operating systems are supported?
ProcrastiScan has only been tested under Windows. Firefox is the only browser to include the nudging intervention. Chrome is supported, and the extension should also be compatible with Opera and MS Edge.

### What are limitations I should be aware of?
- the similarity scoring is mostly a proof of concept at the moment and may not always be accurate. The system might not work well if the information that you provide about your task, related content and common distractions is too vague.
- ProcrastiScan currently can't help you in regards to endless scrolling on the same page, or falling into rabbit holes about random topics that you didn't include in the distracting topics list.
- the chatbot experience is limited by the quality of the language model you use. It is unlikely to fully grasp the context of your situation.

### How does the similarity scoring work?
The scores quantify how semantically similar the tab title + domain (or program name + title) is to the information that you provided about your task and related/distracting content. The score ranges roughly from 0-1, with values below 0.5 being interpreted as distracting content. An averaged score is calculated for the last 10 minutes and weighted by the time spent on each tab. If this score falls below 0.5, an intervention is triggered.

### How how can I make the scores closer to what I expect?
Your information must be semantically related to the content ("how much does A have to do with B?"). For example, if you enter "browsing mindlessly" as a distraction, that is not semantically similar to a tab called "Cat Videos - YouTube". If you were to enter "pets" instead, the similarity to the tab title would be a lot higher. However, proper nouns such as specific websites or creator names should be entered as they are.
