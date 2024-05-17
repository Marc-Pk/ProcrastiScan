// self-report-intervention.js: Popups for rating interventions
let dataSent = false;

function sendSelfReportData() {
    const interventionRating = document.querySelector('input[name="intervention-rating"]').value;

    const isProductiveTime = document.querySelector('input[name="isProductiveTime"]:checked').value;

    browser.runtime.sendMessage({
      type: 'selfReportIntervention',
      interventionRating: interventionRating,
      isProductiveTime: isProductiveTime
    });
    dataSent = true;
}

document.getElementById('self-report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendSelfReportData();
    window.close();
});

// Send the runtime message even if the window closes without clicking submit
window.addEventListener('beforeunload', () => {
    if (dataSent === false) {
    sendSelfReportData();
    }
});
