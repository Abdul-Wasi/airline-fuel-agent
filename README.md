# Airline Fuel Optimization Agent (POC)

## Overview
This agent leverages **AWS Strands** logic and the **Mission Control Protocol (MCP)** to analyze flight plans against meteorological data. 

**🌟 BONUS FEATURE**: This agent automatically generates a **Live HTML Dashboard** (`index.html`) visualizing the savings.

## Architecture
1.  **Ingestion**: Reads flight manifests (e.g., DEL-SXR, BOM-DXB).
2.  **AWS Strands**: Stateful workflow orchestration.
3.  **Optimization**: Analyzes Headwinds/Tailwinds to adjust altitude.
4.  **Dashboard UI**: Generates a static HTML report for stakeholders.

## How to Run & Deploy
1.  **Install**: `npm install`
2.  **Run**: `node index.js`
3.  **View**: Open the generated `index.html` file in your browser.

## Live Demo
(If you deploy to Netlify, paste your link here)

## Technologies
* Node.js, CSV-Parser
* Tailwind CSS (Dashboard UI)
* AWS Strands (Simulated)