// dashboard.js - Visualizing the User's Data

browser.storage.local.get("similarityRatings").then((result) => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Filter and format data for the last 7 days
    const filteredData = result.similarityRatings
        .filter(({ time }) => time >= oneWeekAgo)
        .map(({ time, trs, trsAvg, title }) => ({
            time: new Date(time),
            trs,
            trsAvg,
            title
        }));

    const data = {
        time: filteredData.map(d => d.time),
        trs: filteredData.map(d => d.trs),
        trsAvg: filteredData.map(d => d.trsAvg),
        title: filteredData.map(d => d.title)
    };

    const generateColor = (value) => `rgba(${255 * (1 - value)}, ${255 * value}, 0, 0.4)`;

    // Relevance Score trace
    const similarityRatingTrace = {
        x: data.time,
        y: data.trs,
        mode: 'markers',
        name: 'Relevance Score',
        text: data.title,
        marker: { color: '#375a7f' }
    };

    // Focus Score trace
    const similarityRatingAvgTrace = {
        x: data.time,
        y: data.trsAvg,
        mode: 'markers+lines',
        name: 'Focus Score',
        text: data.title,
        marker: { color: data.trsAvg.map(generateColor) },
        line: { color: '#888888' }
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayData = filteredData.filter(d => d.time.getTime() >= startOfToday);
    const minToday = todayData.length > 0 ? Math.min(...todayData.map(d => d.time.getTime())) : startOfToday;

    const INACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minutes in ms
    const shapes = [];
    let segmentStart = data.time[0]; // Segment start time

    // Add red/green background based on Focus Score
    for (let i = 1; i <= data.time.length; i++) {
        const prevIndex = i - 1;
        const currTime = i < data.time.length ? data.time[i] : null;
        const prevTime = data.time[prevIndex];
        const prevTrsAvg = data.trsAvg[prevIndex];
        const prevCategory = prevTrsAvg > 0.5;

        const timeDiff = currTime ? (currTime - prevTime) : 0;
        const nextCategory = currTime !== null ? data.trsAvg[i] > 0.5 : prevCategory;

        const inactivity = timeDiff > INACTIVITY_THRESHOLD;
        const categoryChanged = currTime !== null && nextCategory !== prevCategory;

        // Condition: Inactivity OR category change OR last data point
        if (inactivity || categoryChanged || i === data.time.length) {
            // Add active segment (colored by Focus Score)
            shapes.push({
                type: 'rect',
                xref: 'x', yref: 'paper',
                x0: segmentStart,
                x1: prevTime,
                y0: 0,
                y1: 1,
                fillcolor: prevCategory
                    ? 'rgba(0, 255, 0, 0.4)' // Green for Focus Score > 0.5
                    : 'rgba(255, 0, 0, 0.4)', // Red otherwise
                opacity: 0.4,
                layer: 'below',
                line: { width: 0 }
            });

            // Add inactivity segment if threshold exceeded
            if (inactivity) {
                shapes.push({
                    type: 'rect',
                    xref: 'x', yref: 'paper',
                    x0: prevTime,
                    x1: currTime,
                    y0: 0,
                    y1: 1,
                    fillcolor: 'rgba(0, 0, 0, 0)',
                    opacity: 0.0,
                    layer: 'below',
                    line: { width: 0 }
                });
            }

            // Update segment start time
            segmentStart = currTime;
        }
    }

    // Time range selector options
    hoursToday = Math.floor((now - startOfToday) / (1000 * 60 * 60));
    const selectorOptions = {
        buttons: [
            { step: 'hour', stepmode: 'backward', count: 1, label: 'Last hour', active: true },
            { step: 'hour', stepmode: 'backward', count: hoursToday, label: 'Today' },
            { step: 'hour', stepmode: 'backward', count: 24+hoursToday, label: 'Yesterday' },
            { step: 'hour', stepmode: 'backward', count: 168+hoursToday, label: 'Last week' }
        ],
        bgcolor: '#222222',
        activecolor: '#303030',
        font: { color: 'white' },
        range: [data.time[0], now],
    };

    const layout = {
        margin: { l: 50, r: 25, b: 50, t: 0, pad: 4 },
        xaxis: {
            title: { text: 'Time', font: { color: 'white' } },
            type: 'date',
            range: [minToday, now],
            color: 'white',
            rangeselector: selectorOptions
        },
        yaxis: {
            title: { text: 'Scores', font: { color: 'white' } },
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
            font: { color: 'white' }
        },
        plot_bgcolor: '#222222',
        paper_bgcolor: '#222222',
        font: { color: 'white' },
        shapes: shapes
    };

    Plotly.react('plot', [similarityRatingTrace, similarityRatingAvgTrace], layout, { displayModeBar: false });
});
