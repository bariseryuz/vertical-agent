import ollama from 'ollama';
// @ts-ignore
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'node:fs';
chromium.use(stealthPlugin());

export class ShiimanEngine {
  model = "llama3.2:3b";

  async runIntelligenceMission(url: string, goal: string, sourceIsApi: boolean) {
    let sourceData = "";

    try {
      if (sourceIsApi) {
        // FAST PATH: Direct raw data harvest 
        const res = await fetch(url);
        sourceData = JSON.stringify(await res.json());
      } else {
        // GHOST PATH: Chromium navigation (The Scraper)
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 6000 });
        sourceData = await page.evaluate(() => document.body.innerText.substring(0, 10000));
        await browser.close();
      }

      console.log(`🧠 SHIIMAN-GHOST-IP: Crunching Intelligence Pack... Data Length: ${sourceData.length}`);

      // SUCCESS-FOCUSED PROMPT:
      // This is the instruction Llama needs to turn raw content into specific billionaire intelligence.
      const aiResponse = await ollama.chat({
        model: this.model,
        messages: [{ 
            role: 'system', 
            content: `ACT AS: Shiiman-Data Intelligence Refiner. 
            MISSION: ${goal}. 
            PROTOCOL RULES: Verify Accuracy 9.5/10. Ignore layout junk. 
            OUTPUT SCALE: Raw Lead Value analysis + Extracted Details. 
            Format STRICTLY in JSON.`
        }, 

        { 
            role: 'user', 
            content: `DATA_DROP: ${sourceData}` 
        }],

        format: 'json',

      });

      const refined = JSON.parse(aiResponse.message.content);
      this._saveFinalIntel(url, refined);
      return refined;

    } catch (err) {
      console.error("Critical Failure:", err);
      return { failure: String(err) };
    }
  }

  // Proprietary Database Protection System
  _saveFinalIntel(u: string, d: any) {
    const database = fs.existsSync('./dataempire.json') ? JSON.parse(fs.readFileSync('./dataempire.json','utf-8')) : [];
    database.push({ url: u, intel: d, captured_at: new Date().toISOString() });
    fs.writeFileSync('./dataempire.json', JSON.stringify(database, null, 2));
    console.log("💾 ASSET SAVED TO EMPIRE CLOUD.");
  }
}