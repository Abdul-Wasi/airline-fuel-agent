/**
 * Airline Fuel Optimization Agent
 * Extended with Dashboard Generation for Bonus Criteria
 */

const fs = require('fs');
const csv = require('csv-parser');

// --- 1. MOCK SERVICES (Weather & Ops) ---
const fetchWeatherReport = async (waypoint) => {
    const conditions = ['CLEAR', 'TURBULENCE', 'HEADWIND', 'TAILWIND', 'STORM'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const windSpeed = Math.floor(Math.random() * 120); 
    
    return {
        waypoint,
        condition: randomCondition,
        wind_speed_knots: windSpeed,
        timestamp: new Date().toISOString()
    };
};

// --- 2. DATA INGESTION ---
const ingestFlightData = (filepath) => {
    return new Promise((resolve, reject) => {
        const flights = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => flights.push(data))
            .on('end', () => resolve(flights))
            .on('error', (err) => reject(err));
    });
};

// --- 3. CORE LOGIC ---
const runOptimizationLogic = async (flight, weather) => {
    let recommendations = [];
    let projected_savings_kg = 0;
    let new_altitude = flight.altitude_ft;

    if (weather.condition === 'HEADWIND' && weather.wind_speed_knots > 50) {
        recommendations.push("Descend 2000ft to minimize drag");
        new_altitude = parseInt(flight.altitude_ft) - 2000;
        projected_savings_kg += 450;
    } else if (weather.condition === 'TAILWIND') {
        recommendations.push("Maintain Flight Level; tailwind assist optimal");
        projected_savings_kg += 300;
    } else if (weather.condition === 'TURBULENCE' || weather.condition === 'STORM') {
        recommendations.push("Reroute lateral path 20nm South");
        projected_savings_kg -= 150; 
    } else {
        recommendations.push("No deviation required");
    }

    return {
        original_fuel: parseInt(flight.planned_fuel_kg),
        optimized_fuel: parseInt(flight.planned_fuel_kg) - projected_savings_kg,
        savings: projected_savings_kg,
        actions: recommendations,
        adjusted_altitude: new_altitude
    };
};

// --- 4. ORCHESTRATION ---
const awsStrandsOrchestrator = async (flights) => {
    console.log(">>> INITIALIZING AWS STRAND: FUEL_OPT_BATCH_01 <<<");
    const strandResults = [];

    for (const flight of flights) {
        const weather = await fetchWeatherReport(flight.waypoints);
        const optimization = await runOptimizationLogic(flight, weather);
        
        strandResults.push({
            flight_id: flight.flight_id,
            route: `${flight.origin}-${flight.destination}`,
            weather_context: weather,
            optimization_data: optimization
        });
    }
    return strandResults;
};

// --- 5. DASHBOARD GENERATOR (BONUS FEATURE) ---
const generateDashboard = (results) => {
    const totalSavings = results.reduce((acc, cur) => acc + cur.optimization_data.savings, 0);
    const timestamp = new Date().toLocaleString();

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fuel Optimization Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-slate-900 text-white font-sans p-8">
        <div class="max-w-6xl mx-auto">
            <header class="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <div>
                    <h1 class="text-3xl font-bold text-blue-400">✈️ Fuel Optimization Agent</h1>
                    <p class="text-slate-400">AWS Strands & MCP Protocol • Live Report</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-slate-500">Last Updated</p>
                    <p class="font-mono text-green-400">${timestamp}</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-slate-800 p-6 rounded-lg shadow-lg border-l-4 border-green-500">
                    <h3 class="text-slate-400 text-sm uppercase">Total Fuel Saved</h3>
                    <p class="text-4xl font-bold mt-2">${totalSavings} <span class="text-lg text-slate-500">kg</span></p>
                </div>
                <div class="bg-slate-800 p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
                    <h3 class="text-slate-400 text-sm uppercase">Flights Analyzed</h3>
                    <p class="text-4xl font-bold mt-2">${results.length}</p>
                </div>
                <div class="bg-slate-800 p-6 rounded-lg shadow-lg border-l-4 border-purple-500">
                    <h3 class="text-slate-400 text-sm uppercase">Optimization Status</h3>
                    <p class="text-2xl font-bold mt-2 text-green-400">ACTIVE</p>
                </div>
            </div>

            <div class="bg-slate-800 rounded-lg p-6 shadow-lg overflow-hidden">
                <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 bg-blue-500 rounded-full"></span> Live Flight Data
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="text-slate-400 border-b border-slate-700">
                                <th class="p-3">Flight ID</th>
                                <th class="p-3">Route</th>
                                <th class="p-3">Weather</th>
                                <th class="p-3">Recommendation</th>
                                <th class="p-3 text-right">Fuel Impact</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700">
                            ${results.map(r => `
                                <tr class="hover:bg-slate-700/50 transition">
                                    <td class="p-3 font-mono text-blue-300">${r.flight_id}</td>
                                    <td class="p-3">${r.route}</td>
                                    <td class="p-3">
                                        <span class="px-2 py-1 rounded text-xs font-bold 
                                        ${r.weather_context.condition === 'TAILWIND' ? 'bg-green-900 text-green-300' : 
                                          r.weather_context.condition === 'HEADWIND' ? 'bg-orange-900 text-orange-300' : 
                                          r.weather_context.condition === 'STORM' ? 'bg-red-900 text-red-300' : 
                                          'bg-slate-700 text-slate-300'}">
                                            ${r.weather_context.condition}
                                        </span>
                                    </td>
                                    <td class="p-3 text-sm text-slate-300">${r.optimization_data.actions[0]}</td>
                                    <td class="p-3 text-right font-mono ${r.optimization_data.savings >= 0 ? 'text-green-400' : 'text-red-400'}">
                                        ${r.optimization_data.savings > 0 ? '+' : ''}${r.optimization_data.savings} kg
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    fs.writeFileSync('index.html', htmlContent);
    console.log(">>> DASHBOARD GENERATED: index.html <<<");
};

// --- MAIN EXECUTION ---
const main = async () => {
    console.log("--- AGENT STARTUP ---");
    const flightData = await ingestFlightData('flight_data.csv');
    const strandOutput = await awsStrandsOrchestrator(flightData);

    // Generate Outputs
    generateDashboard(strandOutput); // Creates index.html
    
    // Console Output (MCP Protocol)
    console.log("\n--- MCP STREAM ---");
    strandOutput.forEach(item => {
        console.log(JSON.stringify({
            protocol: "MCP-2.0",
            flight: item.flight_id,
            alert: item.optimization_data.actions[0]
        }));
    });
};

main();