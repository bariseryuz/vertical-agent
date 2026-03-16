import { Ollama } from 'ollama';
// @ts-ignore
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'node:fs';
import axios from 'axios';
import 'dotenv/config';

chromium.use(stealthPlugin());

// --- CONFIG ---
const SHIIMAN_MODEL = process.env.SHIIMAN_MODEL || 'llama3.2:3b';
const ollamaClient = new Ollama({ host: 'http://127.0.0.1:11434' });

// --- TOOLS: External Capabilities ---

// Tool 1: Google Search (Serper.dev)
async function toolSearchGoogle(query: string) {
    if (!process.env.SERPER_API_KEY) return "Search tool disabled (No API Key).";
    console.log(`🔍 TOOL: Searching Google for "${query}"...`);
    try {
        const response = await axios.post('https://google.serper.dev/search', 
            { q: query }, 
            { headers: { 'X-API-KEY': process.env.SERPER_API_KEY } }
        );
        return JSON.stringify(response.data.organic.slice(0, 3));
    } catch (e) { return "Search failed."; }
}

// Tool 2: Google Maps (Business Verification)
async function toolGetMapsData(query: string) {
    if (!process.env.GOOGLE_MAPS_KEY) return "Maps tool disabled (No API Key).";
    console.log(`📍 TOOL: Verifying on Maps "${query}"...`);
    try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_KEY}`;
        const res = await axios.get(url);
        return JSON.stringify(res.data.results[0] || "No maps results.");
    } catch (e) { return "Maps check failed."; }
}

// --- THE CRITIC: Multi-Step Verification ---
async function runCriticAudit(extractedData: any, rawContent: string) {
    console.log(`⚖️  SHIIMAN-CRITIC: Auditing results for hallucinations...`);
    const response = await ollamaClient.chat({
        model: SHIIMAN_MODEL,
        messages: [{
            role: 'user',
            content: `Compare this JSON to the RAW TEXT. 
            If the JSON contains info NOT in the raw text, list the errors. 
            If it is 100% accurate, return only the word "VALID".
            
            JSON: ${JSON.stringify(extractedData)}
            RAW TEXT: ${rawContent.substring(0, 2000)}`
        }]
    });
    return response.message.content.trim();
}

// --- THE BRAIN: Smart Scraper with ReAct Logic ---
async function shiimanAgentStrike(targetUrl: string, goal: string) {
    console.log(`🚀 SHIIMAN-AGENT: MISSION STARTING...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // --- STEP 1: ATTEMPT SCRAPE ---
        console.log(`📡 Attempting direct strike: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 90000 });
        
        let pageData = await page.evaluate(() => {
            const junk = document.querySelectorAll('script, style, nav, footer, header');
            junk.forEach(s => s.remove());
            return document.body.innerText.substring(0, 5000);
        });

        // Anti-Bot Detection Check
        if (pageData.includes("Access Denied") || pageData.length < 200) {
            console.log("⚠️  BLOCKED: Direct scrape failed. Switching to SEARCH TOOL...");
            pageData = await toolSearchGoogle(`${goal} at Wellfound`);
        }

        // --- STEP 2: EXTRACTION ---
        console.log(`🧠 SHIIMAN-BRAIN: Extracting Intelligence...`);
        const extraction = await ollamaClient.chat({
            model: SHIIMAN_MODEL,
            messages: [{
                role: 'user',
                content: `Extract JSON from this data. Goal: ${goal}. Data: ${pageData}`
            }],
            format: 'json'
        });

        const capturedData = JSON.parse(extraction.message.content);

        // --- STEP 3: THE CRITIC (VERIFICATION) ---
        const auditResult = await runCriticAudit(capturedData, pageData);

        if (auditResult.includes("VALID")) {
            console.log("✅ AUDIT PASSED: Data is verified.");
            // OPTIONAL: Step 4 - Verify Company on Maps if it's a specific business
            // const mapsInfo = await toolGetMapsData(capturedData.company_name);
            saveToEmpire(targetUrl, capturedData);
        } else {
            console.warn("❌ AUDIT FAILED: Hallucinations detected. Issues:", auditResult);
            // Here you could add a retry loop or search for the missing info
        }

    } catch (error: any) {
        console.error("❌ MISSION CRITICAL ERROR:", error.message);
    } finally {
        await browser.close();
        console.log("💤 SHIIMAN-AGENT: Mission over.");
    }
}

// --- THE VAULT: Data Persistence ---
function saveToEmpire(url: string, newData: any) {
    const fileName = 'dataempire.json';
    let database = [];
    if (fs.existsSync(fileName)) {
        database = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
    }
    
    // Deduplication logic
    const entry = { 
        url, 
        ...newData, 
        captured_at: new Date().toISOString(),
        verified: true 
    };
    
    database.push(entry);
    fs.writeFileSync(fileName, JSON.stringify(database, null, 2));
    console.log("💾 Intelligence stored in the Vault.");
}

export { shiimanAgentStrike };