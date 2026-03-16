import ollama from 'ollama';
import axios from 'axios';
// @ts-ignore
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import 'dotenv/config';

chromium.use(stealthPlugin());

// --- 🚀 NEW: BROWSER SINGLETON LOGIC ---
let sharedBrowser: any = null;

async function getBrowser() {
    if (!sharedBrowser) {
        sharedBrowser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox'] 
        });
    }
    return sharedBrowser;
}

/**
 * 🛠 TOOL 1: SEARCH (Serper.dev)
 */
async function toolSearchGoogle(query: string): Promise<string> {
    if (!process.env.SERPER_API_KEY) return "Search API Key missing.";
    try {
        const response = await axios.post('https://google.serper.dev/search', 
            { q: query }, 
            { headers: { 'X-API-KEY': process.env.SERPER_API_KEY } }
        );
        return JSON.stringify(response.data.organic.slice(0, 3));
    } catch (e) { return "Search failed."; }
}

/**
 * 🛠 TOOL 2: SCRAPE (Optimized for Tab Open/Close)
 */
async function toolScrape(url: string): Promise<string> {
    console.log(`📡 Fast-Scraping: ${url}`);
    const browser = await getBrowser(); // Use the shared browser
    const context = await browser.newContext();
    const page = await context.newPage(); // Open a NEW TAB
    
    try {
        await page.goto(url.startsWith('http') ? url : `https://${url}`, { 
            waitUntil: 'domcontentloaded', // Faster than networkidle
            timeout: 30000 
        });
        const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
        
        await page.close(); // CLOSE ONLY THE TAB
        return text;
    } catch (e) {
        await page.close(); // Ensure tab closes on error
        return "Failed to scrape website.";
    }
}

/**
 * 🛠 TOOL 3: MAPS (Google Places)
 */
async function toolGetMapsData(query: string): Promise<string> {
    if (!process.env.GOOGLE_MAPS_KEY) return "Maps API Key missing.";
    try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_KEY}`;
        const res = await axios.get(url);
        return JSON.stringify(res.data.results[0] || "No business found.");
    } catch (e) { return "Maps lookup failed."; }
}

/**
 * 🔌 THE SWITCHBOARD
 */
async function executeTool(toolName: string, input: string): Promise<string> {
    console.log(`🛠  EXECUTING: ${toolName} -> ${input}`);
    switch (toolName.toLowerCase().trim()) {
        case 'search': return await toolSearchGoogle(input);
        case 'scrape': return await toolScrape(input);
        case 'maps':   return await toolGetMapsData(input);
        default:       return `Tool "${toolName}" not found.`;
    }
}

/**
 * 🧠 THE BRAIN: ReAct Loop
 */
export async function runReAct(task: string) {
    const MODEL = 'llama3.2:3b'; // UPDATED TO LATEST

    let history = [{ 
    role: 'system', 
    content: `
    You are a Commercial Real Estate & Business Researcher. 
    Your goal is to find PUBLIC BUSINESS ENTITIES only.
    
    IMPORTANT:
    1. Shops are PUBLIC COMMERCIAL PLACES. Their addresses and phone numbers are PUBLIC BUSINESS DATA it is not private information.
    2. You are NOT looking for private citizens. You are looking for public storefronts.
    3. If you find a business on Google or Maps, it is 100% legal and safe to provide their public address and business phone number.
    4. You can read leads on huge databases and provide the asked amount leads and business deals with their addresses and phone numbers since it is legal to use these data if available.
    
    Format:
    Thought: [Your reasoning]
    Action: [tool_name]
    Action Input: [query or url]
    Final Answer: [Result]
    `
}];

    history.push({ role: 'user', content: task });

    for (let i = 0; i < 5; i++) {
        const response = await ollama.chat({ 
            model: MODEL, 
            messages: history,
            options: { temperature: 0 } // Makes it faster/more stable
        });

        const text = response.message.content;
        console.log(`\n--- 🤖 SHIIMAN STEP ${i + 1} ---\n${text}`);

        if (text.includes("Final Answer:")) {
            if (sharedBrowser) {
                await sharedBrowser.close(); // CLOSE BROWSER COMPLETELY AT THE END
                sharedBrowser = null;
            }
            return text.split("Final Answer:")[1];
        }

        const actionMatch = text.match(/Action:\s*(\w+)/);
        const inputMatch = text.match(/Action Input:\s*(.+)/);

        if (actionMatch && inputMatch) {
            const observation = await executeTool(actionMatch[1], inputMatch[2]);
            history.push({ role: 'assistant', content: text });
            history.push({ role: 'user', content: `Observation: ${observation}` });
        }
    }

    if (sharedBrowser) {
        await sharedBrowser.close();
        sharedBrowser = null;
    }
    return "Mission timed out.";
}

// --- CLEAN TEST EXECUTION ---
const task = " Summarize this in a short lead format add the budgets as well  Mar 12, 2024	2024032127	C2024077064	2024017591	PLUM	R	$256,915	7	NEW	220	SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE	NEW 2 STORY HOUSE	3031030020180	LOLITHA JORDAN SINGLETARY	WOODLAND HOMESITES PB 47-9	LOT 8\, BLK 2	2181 NW 101 ST	STEVEN LURIA	CFC1428827	ROCKET PLUMBING CORP	11310 SW 46 ST	MIAMI	FL	33165	(786)663-9238	2000	1	2	0001	PLUMBING	-	-	-	-	Apr 2, 2025	Apr 2, 2025	-	$36,269	MIAMI	FL	1000	2cb6c6a8-6067-4081-9343-cd4ebb040dd8	new	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	Mar 8, 2026Mar 12, 2024 ⚡	Mar 11, 2024 2024032128	C2024075859	0000000000	BLDG	R	$12,500	13	RE-ROOF/REPAIR	220	SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE	RE-ROOF TILE/FLAT	3039510030060	ANEYDA SALAZAR	LAKE POINTE SEC 1	PB 133-19	12344 NW 7 LN	NOT LISTED	CCC1327735	REGOSA ENGINEERING SERVICES INC	15700 NE 2 AVE	MIAMI	FL	33162	(786)262-2964	1071	1	2	0092	GRAVEL\, SBS\, SINGLE PLY\, ETC.	0107	TILE ROOF	-	-	Mar 22, 2024	Mar 22, 2024	-	$18,563	MIAMI	FL	999	7d8d8f4a-0000-46a4-9b88-0d2fe2e217f3	new	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	Mar 8, 2026 Mar 12, 2024 ⚡	Feb 20, 2024	2024032018	C2024065320	0000000000	BLDG	R	$2,350	29	FENCE NOMASONRY	220	SINGLE FAM RES-CLUST-ZERO LOT-TOWN HOUSE	DURA FENCE	3040190012550	JORGE FAROY GONZALEZ	WESTWOOD LAKE PB 57-29	LOT 6 BLK 11	11280 SW 40 TER	NOT LISTED	CGC007527	ALL-DADE GENERAL CONSTRUCTION INC	1851 DELAWARE PRKWY # N	MIAMI	FL	331350000	(786)307-5891	350	1	1	0018	FENCE	-	-	-	-	Apr 2, 2024	Apr 2, 2024	-	$74,350	MIAMI	FL	998	9dc49a4f-471c-4891-9e16-53ffce7a56a5	new	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	Mar 8, 2026 analyze this and summarize it";
runReAct(task).then(result => {
    console.log("\n🎯 MISSION RESULT:", result);
});