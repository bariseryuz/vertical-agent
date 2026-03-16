import { ShiimanKeyManager } from './keyManager.ts';

const admin = new ShiimanKeyManager();
const projectName = process.argv[2]; 

if (!projectName) {
    console.log("⚠️ Provide a project name: npx tsx src/admin.ts 'Ranch_Dashboard_Team'");
} else {
    admin.generateNewKey(projectName);
}