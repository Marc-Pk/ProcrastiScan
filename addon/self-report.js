// self-report.js: Popups for self-reporting study data
let dataSent = false;

function sendSelfReportData() {
    const stressLevel = document.getElementById('stress-level').value;
    const distractionLevel = document.getElementById('distraction-level').value;
    const isProductiveTime = document.querySelector('input[name="isProductiveTime"]:checked').value;

    browser.runtime.sendMessage({
      type: 'selfReport',
      stressLevel: stressLevel,
      distractionLevel: distractionLevel,
      isProductiveTime: isProductiveTime
    }).then(() => {
        dataSent = true;
        window.close();
    });
}

document.getElementById('self-report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendSelfReportData();
});

// Send the runtime message even if the window closes without clicking submit
window.addEventListener('beforeunload', () => {
    if (dataSent === false) {
    sendSelfReportData();
    }
});
