import ollama from 'ollama'; 


// STEP 5: The Critic / Auditor
export async function runCritic(extractedData: any, rawHtmlText: string) {
    console.log(`⚖️  Auditing extracted data...`);
    const prompt = `
    You are a Data Auditor. 
    Compare the EXTRACTED JSON to the RAW TEXT below.
    
    RAW TEXT: ${rawHtmlText.substring(0, 5000)} 
    
    EXTRACTED JSON: ${JSON.stringify(extractedData)}

    Rules:
    1. If a phone number or email is in the JSON but NOT in the raw text, it is a HALLUCINATION.
    2. If the data is 100% correct, output exactly: "VALID".
    3. If there are errors, list them clearly.
    `;

    const response = await ollama.chat({
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: prompt }]
    });

    return response.message.content;
}