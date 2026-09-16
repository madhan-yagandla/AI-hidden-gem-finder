import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:fastest';
const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

/**
 * Call the Hugging Face Inference Providers API (OpenAI-compatible chat completions)
 * Uses router.huggingface.co with automatic provider selection
 */
async function callHuggingFace(messages, maxTokens = 1024, temperature = 0.7) {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   🤖 HF API call (attempt ${attempt + 1}) → ${HF_MODEL}`);

      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: HF_MODEL,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
      });

      // Handle rate limiting
      if (response.status === 429) {
        console.log('   ⏳ Rate limited, waiting 5s...');
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      // Handle server errors with retry
      if (response.status >= 500) {
        console.log(`   ⏳ Server error ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF API error ${response.status}: ${errorText.substring(0, 300)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Hugging Face');
      return content.trim();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`   ⚠️ Attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('HF API: All retries exhausted');
}

/**
 * Generate AI descriptions with comfort, audience, and image keywords
 */
export async function generateDescriptions(gems) {
  if (!HF_API_KEY) {
    console.log('   ⚠️ No Hugging Face API key — using fallback descriptions');
    return gems.map((gem) => ({
      ...gem,
      aiDescription: generateFallbackDescription(gem),
      gemReason: generateFallbackReason(gem),
      bestTime: 'Morning or late afternoon',
      imageKeyword: gem.category.type,
    }));
  }

  try {
    // Process in batches of 5 to stay within token limits
    const batchSize = 5;
    const allResults = [];

    for (let i = 0; i < gems.length; i += batchSize) {
      const batch = gems.slice(i, i + batchSize);
      const batchResults = await generateBatch(batch, i);
      allResults.push(...batchResults);
    }

    return allResults;
  } catch (error) {
    console.error('   ⚠️ HF generation failed, using fallbacks:', error.message);
    return gems.map((gem) => ({
      ...gem,
      aiDescription: generateFallbackDescription(gem),
      gemReason: generateFallbackReason(gem),
      bestTime: 'Morning or late afternoon',
      imageKeyword: gem.category.type,
    }));
  }
}

/**
 * Generate descriptions for a batch of gems
 */
async function generateBatch(gems, startIndex) {
  const gemsInfo = gems
    .map((gem, i) => {
      const idx = startIndex + i + 1;
      const tagDetails = [];
      if (gem.tags.cuisine) tagDetails.push(`Cuisine: ${gem.tags.cuisine}`);
      if (gem.tags.description) tagDetails.push(`Description: ${gem.tags.description}`);
      if (gem.tags.heritage) tagDetails.push(`Heritage: ${gem.tags.heritage}`);
      if (gem.openingHours) tagDetails.push(`Hours: ${gem.openingHours}`);

      return `${idx}. "${gem.name}" — Category: ${gem.category.label} (${gem.category.type}) | Location: ${gem.lat.toFixed(4)}, ${gem.lon.toFixed(4)}${tagDetails.length > 0 ? ' | ' + tagDetails.join(' | ') : ''}`;
    })
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: 'You are a travel expert specializing in hidden gems. Respond ONLY with a valid JSON array, no markdown, no extra text.',
    },
    {
      role: 'user',
      content: `For each place below, generate:
1. "description": A compelling 2-sentence description (vivid, sensory, atmospheric)
2. "reason": Why it's a hidden gem (1 sentence)
3. "bestTime": Best time to visit (e.g., "Early morning", "Sunset", "Weekday afternoons")
4. "imageKeyword": A 2-3 word search term for finding a representative photo

Places:
${gemsInfo}

Respond ONLY in valid JSON array format:
[{"index": ${startIndex + 1}, "description": "...", "reason": "...", "bestTime": "...", "imageKeyword": "..."}]`,
    },
  ];

  try {
    const textContent = await callHuggingFace(messages, 1500, 0.7);

    // Strip markdown formatting if model wraps in code blocks
    const cleaned = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Try to extract JSON array from the response
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('   ⚠️ No JSON found in HF response, using fallbacks for this batch');
      return gems.map((gem) => ({
        ...gem,
        aiDescription: generateFallbackDescription(gem),
        gemReason: generateFallbackReason(gem),
        bestTime: 'Morning or late afternoon',
        imageKeyword: gem.category.type,
      }));
    }

    const descriptions = JSON.parse(jsonMatch[0]);

    return gems.map((gem, i) => {
      const idx = startIndex + i + 1;
      const aiData = descriptions.find((d) => d.index === idx) || descriptions[i];
      return {
        ...gem,
        aiDescription: aiData?.description || generateFallbackDescription(gem),
        gemReason: aiData?.reason || generateFallbackReason(gem),
        bestTime: aiData?.bestTime || 'Morning or late afternoon',
        imageKeyword: aiData?.imageKeyword || gem.category.type,
      };
    });
  } catch (error) {
    console.log(`   ⚠️ Batch generation failed: ${error.message}`);
    return gems.map((gem) => ({
      ...gem,
      aiDescription: generateFallbackDescription(gem),
      gemReason: generateFallbackReason(gem),
      bestTime: 'Morning or late afternoon',
      imageKeyword: gem.category.type,
    }));
  }
}

/**
 * Chat with AI — parse natural language for hidden gem queries
 */
export async function chatWithAI(userMessage, conversationHistory = []) {
  if (!HF_API_KEY) {
    return {
      reply: "I'd love to help you find hidden gems! However, the AI service isn't properly configured yet. Please provide a valid Hugging Face API Key in the .env file.",
      intent: null,
    };
  }

  try {
    const systemPrompt = `You are "Gem Guide" — an intelligent and enthusiastic travel assistant.

When a user provides their location or asks for recommendations, you must suggest 5 to 7 hidden and less crowded places near their location.

For each place, provide:
1. Place name
2. Exact location (area, city)
3. Approximate distance from the user's location in kilometers
4. Estimated travel time
5. A short 1-2 line description explaining why it is unique or peaceful

RULES:
- Include a variety of places such as nature spots, cafes, temples, and viewpoints.
- Avoid famous or overcrowded places.
- Keep the response clear and structured.
- Be warm and friendly.
- ONLY IF you detect a clear search intent to map these places, include a JSON intent at the END of your message after a separator "---INTENT---".

Intent JSON format:
{"action": "search", "location": "city name", "interests": ["nature","food","art","history","spiritual","culture","viewpoints","relaxation"], "radius": 5000, "mood": "peaceful|adventurous|romantic|fun"}

Examples:
- User: "I am in Jaipur." → Respond with 5-7 places nicely formatted, then ---INTENT--- {"action":"search","location":"Jaipur","interests":["nature","food","art","history"],"radius":5000,"mood":"peaceful"}
- User: "What can you do?" → explain your capabilities, no intent.`;

    // Build messages with conversation history
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history (last 8 turns)
    for (const msg of conversationHistory.slice(-8)) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      const text = msg.parts?.[0]?.text || msg.content || '';
      if (text && (role === 'user' || role === 'assistant')) {
        messages.push({ role, content: text });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    const text = await callHuggingFace(messages, 800, 0.85);

    // Parse intent if present
    let reply = text;
    let intent = null;

    if (text.includes('---INTENT---')) {
      const parts = text.split('---INTENT---');
      reply = parts[0].trim();
      try {
        const intentJson = parts[1].trim().match(/\{[\s\S]*?\}/);
        if (intentJson) {
          intent = JSON.parse(intentJson[0]);
        }
      } catch (e) {
        // Intent parsing failed, that's OK
      }
    }

    return { reply, intent };
  } catch (error) {
    console.error('   ⚠️ Chat error:', error.message);

    // Smart fallback: try to parse intent locally when API fails
    const fallback = parseFallbackIntent(userMessage);
    if (fallback.intent) {
      return {
        reply: `Great choice! 🌟 Let me search for **${fallback.intent.interests.join(', ')}** spots in **${fallback.intent.location}**! I'll find some amazing hidden gems for you. ✨`,
        intent: fallback.intent,
      };
    }

    return {
      reply: "I'm having a little trouble connecting right now. But you can try asking me about a specific city — like **\"Show me nature spots in Jaipur\"** — and I'll search for you! 🔍",
      intent: null,
    };
  }
}

/**
 * Fallback intent parser — extracts location and interests from natural language
 * when the AI API is unavailable
 */
function parseFallbackIntent(message) {
  const lower = message.toLowerCase();

  const cities = [
    'delhi', 'mumbai', 'bangalore', 'bengaluru', 'chennai', 'kolkata', 'hyderabad',
    'pune', 'jaipur', 'ahmedabad', 'lucknow', 'chandigarh', 'goa', 'varanasi',
    'udaipur', 'jodhpur', 'agra', 'shimla', 'manali', 'rishikesh', 'mysore',
    'ooty', 'darjeeling', 'amritsar', 'kochi', 'trivandrum', 'bhopal', 'indore',
    'surat', 'nagpur', 'coimbatore', 'vizag', 'visakhapatnam', 'madurai',
    'new delhi', 'noida', 'gurgaon', 'gurugram', 'dehradun', 'mussoorie',
    'london', 'new york', 'paris', 'tokyo', 'dubai', 'singapore', 'barcelona',
    'rome', 'madrid', 'berlin', 'amsterdam', 'los angeles', 'san francisco',
    'chicago', 'toronto', 'sydney', 'melbourne', 'seoul', 'bangkok', 'kuala lumpur',
    'bali', 'phuket', 'istanbul', 'cape town', 'cairo', 'vienna', 'prague', 'venice',
  ];

  const interestMap = {
    nature: ['nature', 'park', 'garden', 'green', 'tree', 'forest', 'lake', 'river', 'mountain', 'hill', 'trail', 'hiking', 'outdoor', 'scenic', 'waterfall'],
    food: ['food', 'eat', 'restaurant', 'cafe', 'coffee', 'street food', 'cuisine', 'dining', 'snack', 'biryani', 'dosa', 'thali', 'dessert', 'bakery'],
    art: ['art', 'gallery', 'museum', 'painting', 'sculpture', 'creative', 'craft', 'design', 'exhibition'],
    history: ['history', 'heritage', 'fort', 'palace', 'monument', 'ancient', 'old', 'historical', 'ruins', 'archaeological'],
    spiritual: ['spiritual', 'temple', 'church', 'mosque', 'monastery', 'meditation', 'yoga', 'prayer', 'sacred', 'religious'],
    culture: ['culture', 'cultural', 'tradition', 'festival', 'local', 'market', 'bazaar', 'handicraft', 'folk'],
    viewpoints: ['view', 'viewpoint', 'sunset', 'sunrise', 'panoramic', 'rooftop', 'overlook', 'scenery', 'photography'],
    relaxation: ['relax', 'peaceful', 'quiet', 'calm', 'serene', 'spa', 'retreat', 'tranquil', 'chill', 'unwind'],
  };

  const moodMap = {
    peaceful: ['peaceful', 'calm', 'quiet', 'serene', 'tranquil', 'relax', 'chill'],
    adventurous: ['adventure', 'exciting', 'explore', 'trek', 'hike', 'thrilling'],
    romantic: ['romantic', 'couple', 'date', 'love', 'intimate'],
    fun: ['fun', 'friends', 'group', 'party', 'lively', 'exciting', 'vibrant'],
  };

  let location = null;
  const locationMatch = lower.match(/(?:in|near|around|at)\s+([a-z\s\-]+?)(?:\s*(?:for|with|and|,|\.|\\?|!|$))/);

  if (locationMatch && locationMatch[1].trim().length > 2 && locationMatch[1].trim().length < 25) {
    location = locationMatch[1].trim();
    location = location.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else {
    for (const city of cities) {
      if (lower.includes(city)) {
        location = city.charAt(0).toUpperCase() + city.slice(1);
        if (city === 'new delhi') location = 'New Delhi';
        break;
      }
    }
  }

  if (!location) return { intent: null };

  const interests = [];
  for (const [category, keywords] of Object.entries(interestMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      interests.push(category);
    }
  }

  if (interests.length === 0) {
    interests.push('nature', 'art', 'history');
  }

  let mood = 'adventurous';
  for (const [m, keywords] of Object.entries(moodMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      mood = m;
      break;
    }
  }

  return {
    intent: {
      action: 'search',
      location,
      interests,
      radius: 5000,
      mood,
    },
  };
}

function generateFallbackDescription(gem) {
  const templates = {
    nature: `A serene natural spot that offers a peaceful escape from the urban bustle. Perfect for nature lovers seeking an authentic outdoor experience.`,
    food: `A local culinary treasure waiting to be discovered. This spot offers genuine flavors that you won't find in typical tourist guides.`,
    art: `An artistic gem that showcases creativity off the beaten path. A must-visit for those who appreciate authentic cultural expression.`,
    history: `A piece of history tucked away from the mainstream tourist trail. This site whispers stories of a fascinating past.`,
    spiritual: `A tranquil sanctuary that offers a moment of peace and reflection. Visitors often describe a sense of calm upon entering.`,
    culture: `A cultural landmark that embodies the authentic spirit of the local community. Far from the tourist crowds, it offers genuine encounters.`,
    viewpoints: `A breathtaking vantage point that most visitors never find. The panoramic views from here are truly unforgettable.`,
    relaxation: `A peaceful retreat perfect for unwinding and recharging. This hidden oasis offers serenity away from the crowds.`,
  };
  return templates[gem.category.type] || `A unique and lesser-known destination that offers an authentic experience. Well worth the journey for curious explorers.`;
}

function generateFallbackReason(gem) {
  if (!gem.hasWikipedia) {
    return `Not listed on Wikipedia — a truly under-the-radar ${gem.category.label} waiting to be discovered.`;
  }
  return `A ${gem.category.label} that flies under the radar despite its charm and character.`;
}
