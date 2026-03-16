import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import ollama from 'ollama'; 
import 'dotenv/config'; // Loads your SHIIMAN_MODEL from .env

const app = express();
app.use(cors());
app.use(express.json());


// --- CONFIGURATION ---
const SHIIMAN_MODEL = process.env.SHIIMAN_MODEL || 'llama3.2:3b';
const KEYS_FILE = './api_keys.json';

// --- 1. KNOWLEDGE BASE: Reads your files to give the AI "Memory" ---
async function getShiimanKnowledgeBase() {
    try {
        const empirePath = path.join(process.cwd(), 'dataempire.json');
        const notesPath = path.join(process.cwd(), 'notes.md');

        // Check if files exist before reading
        let empireRaw = "[]";
        let notesRaw = "";

        try {
            empireRaw = await fs.readFile(empirePath, 'utf-8');
            notesRaw = await fs.readFile(notesPath, 'utf-8');
        } catch (e) {
            console.log("⚠️ Some knowledge files are missing, starting with empty memory.");
        }

        return `
            PAST CASE STUDIES & SUCCESSES:
            ${empireRaw}

            INTERNAL STRATEGY & NOTES:
            ${notesRaw}
        `.substring(0, 6000); // Keep smaller for faster inference
    } catch (err) {
        console.error("Knowledge Base Error:", err);
        return "No internal knowledge available.";
    }
}

// --- 2. AUTHENTICATION: Custom Interface for TypeScript ---
interface AuthenticatedRequest extends Request {
    projectIdentity?: string;
}

const authenticateProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const clientKey = req.headers['x-api-key'] || req.headers['x-shiiman-token'];
    
    if (!clientKey) {
        return res.status(401).json({ error: "Unauthorized: Missing API Key" });
    }

    try {
        const data = await fs.readFile(KEYS_FILE, 'utf-8');
        const keys = JSON.parse(data);

        const project = keys.find((k: any) => k.issued_key === clientKey);

        if (!project) {
            return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
        }

        // Update usage count
        project.usage_count += 1;
        await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2));

        req.projectIdentity = project.identity; 
        next();
    } catch (err) {
        res.status(500).json({ error: "Internal Auth Error" });
    }
};

const buildPrompt = (internalKnowledge: string, projectIdentity: string, task: string, leadData: unknown) => `
SYSTEM: You are the Shiiman Intelligence Agent. Use the instruction provided to give asked accurate details.

INTERNAL KNOWLEDGE: 
${internalKnowledge}

---
PROJECT CONTEXT: ${projectIdentity}
CURRENT TASK: ${task || 'Summarize and score this lead'}
NEW LEAD DATA: ${JSON.stringify(leadData)}

INSTRUCTION: If this lead looks similar to one in our PAST CASE STUDIES, mention it. 
Identify if this lead is a high-priority opportunity based on our STRATEGY NOTES.`;

// --- 3a. STREAMING ENDPOINT (fast perceived response) ---
app.post('/api/v1/analyze/stream', authenticateProject, async (req: AuthenticatedRequest, res: Response) => {
    const { leadData, task } = req.body;
    const internalKnowledge = await getShiimanKnowledgeBase();
    const prompt = buildPrompt(internalKnowledge, req.projectIdentity!, task || '', leadData ?? {});

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
        console.log(`🧠 [stream] project: [${req.projectIdentity}] model: ${SHIIMAN_MODEL}`);
        const stream = await ollama.generate({
            model: SHIIMAN_MODEL,
            prompt,
            stream: true,
            options: { num_predict: 1024 }, // cap length for faster replies
        });
        let full = '';
        for await (const chunk of stream) {
            if (chunk.response) {
                full += chunk.response;
                res.write(JSON.stringify({ chunk: chunk.response }) + '\n');
                (res as any).flush?.();
            }
        }
        res.write(JSON.stringify({ done: true, result: full }) + '\n');
        res.end();
    } catch (error) {
        console.error("AI Error:", error);
        res.write(JSON.stringify({ error: "AI Processing Failed" }) + '\n');
        res.end();
    }
});

// --- 3b. NON-STREAMING ENDPOINT (same as before) ---
app.post('/api/v1/analyze', authenticateProject, async (req: AuthenticatedRequest, res: Response) => {
    const { leadData, task } = req.body;
    const internalKnowledge = await getShiimanKnowledgeBase();
    const prompt = buildPrompt(internalKnowledge, req.projectIdentity!, task || '', leadData ?? {});

    try {
        console.log(`🧠 AI is thinking for project: [${req.projectIdentity}] using [${SHIIMAN_MODEL}]`);
        const response = await ollama.generate({
            model: SHIIMAN_MODEL,
            prompt,
            options: { num_predict: 1024 },
        });
        res.json({ 
            success: true,
            project: req.projectIdentity,
            model: SHIIMAN_MODEL,
            result: response.response 
        });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "AI Processing Failed" });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🛡️  SHIIMAN UNIVERSAL AGENT ONLINE
    📡 Port: ${PORT}
    🧠 Model: ${SHIIMAN_MODEL}
    ____________________________________
    `);
});