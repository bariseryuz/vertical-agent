import { ChromaClient } from 'chromadb';
import ollama from 'ollama'; 

const client = new ChromaClient();

export async function addToVectorDB(data: any[]) {
    const collection = await client.getOrCreateCollection({ name: "leads" });

    for (const item of data) {
        // Create an embedding for the lead
        const text = `${item.url} ${item["Business Name"]} ${item.Services}`;
        const embeddingResponse = await ollama.embeddings({
            model: 'llama3.2:3b',
            prompt: text
        });

        await collection.add({
            ids: [item.url],
            embeddings: [embeddingResponse.embedding],
            metadatas: [item],
            documents: [text]
        });
    }
}