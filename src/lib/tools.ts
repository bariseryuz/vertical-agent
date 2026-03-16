import axios from 'axios';

// STEP 3: Google Search via Serper.dev

export async function searchGoogle(query: string) {
    console.log(`🔍 Searching Google for: ${query}`);
    try {
        const response = await axios.post('https://google.serper.dev/search', {
            q: query
        }, {
            headers: { 'X-API-KEY': process.env.SERPER_API_KEY }
        });

        // Return only the top 3 results to save tokens
        return JSON.stringify(response.data.organic.slice(0, 3));
    } catch (error) {
        return "Search failed.";
    }
}

// STEP 4: Google Maps API for Verification
export async function getMapsData(businessName: string) {
    console.log(`📍 Checking Google Maps for: ${businessName}`);
    try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${businessName}&key=${process.env.GOOGLE_MAPS_KEY}`;
        const res = await axios.get(url);
        const place = res.data.results[0];

        if (!place) return "Business not found on Maps.";

        return JSON.stringify({
            name: place.name,
            address: place.formatted_address,
            rating: place.rating,
            status: place.business_status, // "OPERATIONAL" or "CLOSED"
            types: place.types
        });
    } catch (error) {
        return "Maps check failed.";
    }
}