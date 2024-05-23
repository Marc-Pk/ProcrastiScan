// dashboard.js - Visualizing the User's Data

document.addEventListener('DOMContentLoaded', () => {
    browser.runtime.sendMessage({ type: 'getDashboardData'});

    browser.runtime.onMessage.addListener(request => {
        if (request.type === 'dashboardData') {

            // convert the data from the request into a format that Plotly can use
            const data = {
                time: Object.values(request.data.time).map(t => new Date(t)),
                similarity_rating: Object.values(request.data.similarity_rating),
                similarity_rating_avg: Object.values(request.data.similarity_rating_avg),
                title: Object.values(request.data.title)
            };

            const similarityRatingTrace = {
                x: data.time,
                y: data.similarity_rating,
                mode: 'markers',
                name: 'Similarity Score',
                text: data.title,
                marker: {
                    color: '#375a7f'
                }
            };

            const similarityRatingAvgTrace = {
                x: data.time,
                y: data.similarity_rating_avg,
                mode: 'lines+markers',
                name: 'Average Similarity Score',
                text: data.title,
                marker: {
                    color: '#f39c12'
                }
            };

            // range selector options for the x-axis
            const selectorOptions = {
                buttons: [
                    {
                        step: 'hour',
                        stepmode: 'backward',
                        count: 1,
                        label: 'Last hour'
                    },
                    {
                        step: 'hour',
                        stepmode: 'backward',
                        count: 24,
                        label: 'Last day',
                        active: true
                    },
                    {
                        step: 'hour',
                        stepmode: 'backward',
                        count: 168,
                        label: 'Last week'
                    }
                ],
                bgcolor: '#222222',
                activecolor: '#303030',
                font: { color: 'white' },
                range: [data.time[0], data.time[data.time.length - 1]],
            };

            const layout = {
                margin: {
                    l: 50,
                    r: 25,
                    b: 50,
                    t: 0,
                    pad: 4
                  },
                
                xaxis: {
                    title: {
                        text: 'Time',
                        font: {
                            color: 'white'
                        }
                    },
                    type: 'date',
                    range: [data.time[0], data.time[data.time.length - 1]],
                    rangeselector: selectorOptions,
                    color: 'white',
                    tickangle: 0

                },
                yaxis: {
                    title: {
                        text: 'Similarity Scores',
                        font: {
                            color: 'white'
                        }
                    },
                    range: [0, 1],
                    fixedrange: true,
                    color: 'white'
                },
                legend: {
                    orientation: 'h',
                    x: 0.6,
                    xanchor: 'center',
                    y: 1,
                    yanchor: 'bottom',
                    font: {
                        color: 'white'
                    }
                },
                plot_bgcolor: '#222222',
                paper_bgcolor: '#222222',
                font: {
                    color: 'white'
                },

            };

            const config = {
                displayModeBar: false
            };            

            const plotData = [similarityRatingTrace, similarityRatingAvgTrace];
            Plotly.newPlot('plot', plotData, layout, config);
        }
    });
});