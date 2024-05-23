// self-report-intervention.js: Popups for rating interventions
let dataSent = false;

function sendSelfReportData() {
    const interventionRating = document.querySelector('input[name="intervention-rating"]').value;

    const isProductiveTime = document.querySelector('input[name="isProductiveTime"]:checked').value;
    
    browser.runtime.sendMessage({
      type: 'selfReportIntervention',
      interventionRating: interventionRating,
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
