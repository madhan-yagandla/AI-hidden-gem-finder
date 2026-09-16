import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { searchPlaces } from './overpass.js';
import { filterHiddenGems } from './filter.js';
import { generateDescriptions, chatWithAI } from './gemini.js';
import NodeCache from 'node-cache';
import { z } from 'zod';
import { connectDB, getDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import { v4 as uuidv4 } from 'uuid';
import { protect } from './middleware/authMiddleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';

// Connect to SQLite DB
connectDB();

// Init cache: 1 hour standard TTL
const cache = new NodeCache({ stdTTL: 3600 });

// Validation Schemas
const ExploreSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  interests: z.array(z.string()).min(1),
  radius: z.number().min(500).max(50000).optional().default(5000),
});

const ChatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.any()).optional().default([]),
  contextPlaces: z.array(z.any()).optional(),
});

const app = express();
const PORT = process.env.PORT || 3001;

// Security Headers and CORS
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: isProduction
    ? true  // Same-domain on Render — allow all (no CORS needed)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// Serve Vite build in production
if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
}

// Auth Routes
app.use('/api/auth', authRoutes);

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // limit each IP to 50 requests
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/explore', apiLimiter);
app.use('/api/chat', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main exploration endpoint
app.post('/api/explore', async (req, res) => {
  try {
    const parseResult = ExploreSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.issues });
    }
    const { lat, lon, interests, radius } = parseResult.data;

    // Cache key based on roughly 1km grid (2 decimal places) to improve cache hit rate
    const cacheKey = `explore_${lat.toFixed(2)}_${lon.toFixed(2)}_${interests.sort().join(',')}_${radius}`;
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`\n⚡ Cache hit for (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
      return res.json(cachedResponse);
    }

    console.log(`\n🔍 Exploring near (${lat}, ${lon}) | Interests: ${interests?.join(', ')} | Radius: ${radius}m`);

    // Step 1: Fetch raw places from OpenStreetMap
    console.log('📡 Fetching places from OpenStreetMap...');
    const rawPlaces = await searchPlaces(lat, lon, interests, radius);
    console.log(`   Found ${rawPlaces.length} raw places`);

    if (rawPlaces.length === 0) {
      return res.json({ gems: [], message: 'No places found in this area. Try expanding the radius or changing interests.' });
    }

    // Step 2: Filter for hidden gems (with travel info)
    console.log('💎 Filtering for hidden gems...');
    const gems = filterHiddenGems(rawPlaces, 15, lat, lon);
    console.log(`   Identified ${gems.length} hidden gems`);

    // Step 3: Generate AI descriptions
    console.log('🤖 Generating AI descriptions...');
    const gemsWithDescriptions = await generateDescriptions(gems);
    console.log(`   Generated descriptions for ${gemsWithDescriptions.length} gems`);

    // Step 4: Add image URLs
    const gemsWithImages = gemsWithDescriptions.map((gem) => ({
      ...gem,
      imageUrl: getImageUrl(gem),
    }));

    const responsePayload = { gems: gemsWithImages, total: rawPlaces.length };
    cache.set(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('❌ Error in /api/explore:', error.message);
    res.status(500).json({ error: 'Failed to explore area. Please try again.' });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const parseResult = ChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid parameters', details: parseResult.error.issues });
    }
    const { message, history, contextPlaces } = parseResult.data;

    console.log(`\n💬 Chat: "${message}"`);

    const { reply, intent } = await chatWithAI(message, history, contextPlaces);

    // If intent has a search action, perform the search automatically
    let gems = null;
    if (intent && intent.action === 'search' && intent.location) {
      try {
        // Geocode the location
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(intent.location)}&limit=1`,
          { headers: { 'User-Agent': 'HiddenGemExplorer/1.0' } }
        );
        const geoData = await geoRes.json();

        if (geoData.length > 0) {
          const lat = parseFloat(geoData[0].lat);
          const lon = parseFloat(geoData[0].lon);
          const radius = intent.radius || 5000;
          const interests = intent.interests || ['nature', 'art', 'history'];

          const rawPlaces = await searchPlaces(lat, lon, interests, radius);
          const filtered = filterHiddenGems(rawPlaces, 8, lat, lon);
          const described = await generateDescriptions(filtered);
          gems = described.map((gem) => ({
            ...gem,
            imageUrl: getImageUrl(gem),
          }));

          console.log(`   Chat search found ${gems.length} gems in ${intent.location}`);
        }
      } catch (e) {
        console.error('   Chat search failed:', e.message);
      }
    }

    res.json({ reply, intent, gems });
  } catch (error) {
    console.error('❌ Error in /api/chat:', error.message);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

// Database API Endpoints
app.get('/api/favorites', protect, async (req, res) => {
  try {
    const db = getDB();
    if (!db) return res.status(500).json({ error: 'Database unavailable' });

    const favorites = await db.all('SELECT gemData FROM favorites WHERE userId = ?', [req.user._id]);
    res.json(favorites.map(f => JSON.parse(f.gemData)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/favorites', protect, async (req, res) => {
  try {
    const db = getDB();
    if (!db) return res.status(500).json({ error: 'Database unavailable' });

    const { gem } = req.body;
    if (!gem || !gem.id) return res.status(400).json({ error: 'gem is required' });
    
    // Upsert equivalent in SQLite: INSERT OR REPLACE
    const id = uuidv4();
    const gemDataStr = JSON.stringify(gem);
    
    await db.run(
      'INSERT OR REPLACE INTO favorites (id, userId, gemId, gemData) VALUES (COALESCE((SELECT id FROM favorites WHERE userId = ? AND gemId = ?), ?), ?, ?, ?)',
      [req.user._id, gem.id.toString(), id, req.user._id, gem.id.toString(), gemDataStr]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

app.delete('/api/favorites/:gemId', protect, async (req, res) => {
  try {
    const db = getDB();
    if (!db) return res.status(500).json({ error: 'Database unavailable' });

    const { gemId } = req.params;
    if (!gemId) return res.status(400).json({ error: 'gemId is required' });
    
    const result = await db.run('DELETE FROM favorites WHERE userId = ? AND gemId = ?', [req.user._id, gemId.toString()]);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

/**
 * Generate a deterministic image URL for a gem
 * Uses Lorem Picsum with a seed based on the place name for consistent images
 */
function getImageUrl(gem) {
  // Category-specific curated image collections
  const categoryImages = {
    nature: [1015, 1018, 1036, 1043, 1047, 1055, 1073, 29, 15, 1019],
    food: [292, 312, 326, 376, 429, 431, 488, 493, 674, 755],
    art: [69, 137, 145, 248, 380, 421, 450, 598, 633, 777],
    history: [64, 122, 164, 265, 318, 367, 426, 548, 588, 731],
    spiritual: [120, 186, 278, 355, 402, 449, 547, 684, 756, 825],
    culture: [42, 113, 219, 290, 335, 452, 529, 637, 718, 843],
    viewpoints: [10, 36, 100, 110, 158, 238, 304, 425, 483, 569],
    relaxation: [14, 28, 91, 142, 177, 257, 342, 447, 520, 628],
  };

  // Get category images or default
  const images = categoryImages[gem.category.type] || categoryImages.nature;

  // Deterministic selection based on place name
  const nameHash = gem.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const imageId = images[nameHash % images.length];

  return `https://picsum.photos/id/${imageId}/600/300`;
}

// SPA catch-all: serve index.html for all non-API routes in production
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🌍 Hidden Gem Explorer API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${isProduction ? '🚀 Production' : '🔧 Development'}`);
  console.log(`   Hugging Face API: ${process.env.HF_API_KEY ? '✅ Configured' : '⚠️ Not configured'}`);
  if (process.env.HF_API_KEY) {
    console.log(`   Model: ${process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:fastest'}`);
  }
});
