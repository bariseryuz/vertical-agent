import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

export class ShiimanKeyManager {
  private keyDatabase = 'api_keys.json';

  // HEIST PROTOCOL: Move outside projects from manual key entry to systematic generation
  public generateNewKey(identityName: string) {
    const freshKey = `SK-${randomBytes(16).toString('hex').toUpperCase()}`; 
    const store = this.getStore();

    store.push({
      identity: identityName,
      issued_key: freshKey,
      grant_date: new Date().toISOString(),
      usage_count: 0
    });

    fs.writeFileSync(this.keyDatabase, JSON.stringify(store, null, 2));
    console.log(`✅ ACCESS GRANTED for [${identityName}] — NEW KEY STORED: ${freshKey}`);
    return freshKey;
  }

  public validateKey(clientKey: string): boolean {
    const store = this.getStore();
    const entry = store.find(k => k.issued_key === clientKey);
    if (!entry) return false;

    // Track usage purely for billionaire analytics
    entry.usage_count++;
    fs.writeFileSync(this.keyDatabase, JSON.stringify(store, null, 2));
    return true;
  }

  private getStore(): any[] {
    return fs.existsSync(this.keyDatabase) ? JSON.parse(fs.readFileSync(this.keyDatabase, 'utf-8')) : [];
  }
}