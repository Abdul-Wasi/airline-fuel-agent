const fs = require('fs');
const csv = require('csv-parser');

// Simulating the external weather service for now.
// TODO: Replace this with NOAA API or AviationStack for production.
const getWeather = async (waypoint) => {
    const conditions = ['CLEAR', 'HEADWIND', 'TAILWIND', 'TAILWIND', 'TURBULENCE'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    
    // Simulating strong winds to ensure we see optimization results in the demo
    const windSpeed = 60 + Math.floor(Math.random() * 60); 
    
    return {
        waypoint,
        condition: randomCondition,
        wind_speed_knots: windSpeed,
        timestamp: new Date().toISOString()
    };
};

const loadFlightData = (filepath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
};

// Core business logic for fuel savings
const optimizeFlight = async (flight, weather) => {
    let actions = [];
    let savings = 0; // in kg
    let newAlt = flight.altitude_ft;

    // Rule 1: Headwinds
    if (weather.condition === 'HEADWIND' && weather.wind_speed_knots > 50) {
        actions.push("Descend 2000ft to minimize drag");
        newAlt = parseInt(flight.altitude_ft) - 2000;
        savings += 450;
    } 
    // Rule 2: Tailwinds
    else if (weather.condition === 'TAILWIND') {
        actions.push("Maintain Flight Level; tailwind assist optimal");
        savings += 300;
    } 
    // Rule 3: Safety/Turbulence
    else if (weather.condition === 'TURBULENCE' || weather.condition === 'STORM') {
        actions.push("Reroute lateral path 20nm South");
        savings -= 150; // costly but necessary for safety
    } 
    else {
        actions.push("No deviation required");
    }

    return {
        original_fuel: parseInt(flight.planned_fuel_kg),
        optimized_fuel: parseInt(flight.planned_fuel_kg) - savings,
        savings: savings,
        recommendation: actions[0], // taking top priority action
        adjusted_altitude: newAlt
    };
};

// Simulates the AWS Strand workflow state
const runStrandWorkflow = async (flights) => {
    console.log(`[Strand] Starting batch processing for ${flights.length} flights...`);
    const results = [];

    for (const flight of flights) {
        // Step 1: Get Context
        const weather = await getWeather(flight.waypoints);
        
        // Step 2: Run Logic
        const result = await optimizeFlight(flight, weather);
        
        results.push({
            id: flight.flight_id,
            route: `${flight.origin}-${flight.destination}`,
            weather: weather,
            optimization: result
        });
    }
    return results;
};

// Generates the visual report (Bonus requirement)
const generateHtmlReport = (data) => {
    const totalSavings = data.reduce((sum, item) => sum + item.optimization.savings, 0);
    const dateStr = new Date().toLocaleString();

    // Using Tailwind via CDN for quick styling
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Fuel Optimization Report</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-gray-100 font-sans p-10">
        <div class="max-w-5xl mx-auto">
            <div class="flex justify-between items-end mb-10 border-b border-gray-700 pb-4">
                <div>
                    <h1 class="text-3xl font-bold text-blue-400">✈️ Fuel Optimization Agent</h1>
                    <p class="text-gray-400 mt-1">Live MCP Protocol Feed</p>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-500">Last Run</div>
                    <div class="font-mono text-green-400">${dateStr}</div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-6 mb-10">
                <div class="bg-gray-800 p-6 rounded border-l-4 border-green-500">
                    <div class="text-gray-400 text-xs uppercase tracking-wider">Total Savings</div>
                    <div class="text-3xl font-bold mt-2">${totalSavings} kg</div>
                </div>
                <div class="bg-gray-800 p-6 rounded border-l-4 border-blue-500">
                    <div class="text-gray-400 text-xs uppercase tracking-wider">Flights Scanned</div>
                    <div class="text-3xl font-bold mt-2">${data.length}</div>
                </div>
                <div class="bg-gray-800 p-6 rounded border-l-4 border-purple-500">
                    <div class="text-gray-400 text-xs uppercase tracking-wider">System Status</div>
                    <div class="text-2xl font-bold mt-2 text-green-400">ONLINE</div>
                </div>
            </div>

            <div class="bg-gray-800 rounded shadow-xl overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-gray-700 text-gray-400">
                        <tr>
                            <th class="p-4">Flight</th>
                            <th class="p-4">Route</th>
                            <th class="p-4">Conditions</th>
                            <th class="p-4">Action</th>
                            <th class="p-4 text-right">Net Impact</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        ${data.map(row => `
                            <tr class="hover:bg-gray-700 transition">
                                <td class="p-4 font-mono text-blue-300">${row.id}</td>
                                <td class="p-4">${row.route}</td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded text-xs font-bold bg-gray-600 text-gray-200">
                                        ${row.weather.condition}
                                    </span>
                                </td>
                                <td class="p-4 text-sm text-gray-300">${row.optimization.recommendation}</td>
                                <td class="p-4 text-right font-mono ${row.optimization.savings >= 0 ? 'text-green-400' : 'text-red-400'}">
                                    ${row.optimization.savings > 0 ? '+' : ''}${row.optimization.savings} kg
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>`;

    fs.writeFileSync('index.html', html);
    console.log("-> Dashboard updated: index.html");
};

const main = async () => {
    try {
        console.log("Initializing Agent...");
        
        // 1. Ingest
        const rawData = await loadFlightData('flight_data.csv');
        
        // 2. Process (Strands)
        const processedData = await runStrandWorkflow(rawData);

        // 3. Generate Report
        generateHtmlReport(processedData);

        // 4. Output MCP Stream
        console.log("\n--- MCP OUTPUT STREAM ---");
        processedData.forEach(item => {
            // Formatting for MCP 2.0 standard
            console.log(JSON.stringify({
                protocol: "MCP-2.0",
                flight_id: item.id,
                alert_type: "FUEL_OPT",
                message: item.optimization.recommendation
            }));
        });

    } catch (error) {
        console.error("Critical Error:", error);
    }
};

main();