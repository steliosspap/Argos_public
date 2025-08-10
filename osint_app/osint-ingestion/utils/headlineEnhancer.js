import OpenAI from 'openai';

/**
 * Headline Enhancement Module
 * Uses GPT-4 to create clear, informative headlines for military/conflict events
 */

// Lazy load OpenAI client
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[HeadlineEnhancer] WARNING: OPENAI_API_KEY not found in environment variables');
      throw new Error('OpenAI API key not configured');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

const ENHANCEMENT_PROMPT = `You are a military conflict news editor. Your task is to create clear, informative headlines that accurately describe military actions and conflicts.

Given the original headline and article content, create an enhanced headline that:
1. Clearly states WHO did WHAT to WHOM
2. Includes WHERE the action took place
3. Mentions WHEN if recent/specific
4. Includes key numbers (casualties, weapons, scale) when available
5. Uses active voice and strong verbs
6. Avoids vague terms like "tensions rise" or "situation develops"

Good examples:
- "Russian Forces Strike Kyiv with 20 Missiles, 5 Killed"
- "Hamas Launches 150 Rockets at Tel Aviv, IDF Intercepts Most"
- "US Drone Strike Kills Senior Al-Qaeda Commander in Syria"
- "Myanmar Military Raids Opposition Stronghold, 30 Civilians Flee"

Bad examples:
- "Tensions Rise in Middle East"
- "Update on Ukraine Situation"
- "Military Activity Reported"

Return ONLY the enhanced headline, nothing else.`;

/**
 * Enhance a headline using GPT-4
 * @param {Object} params - Parameters for enhancement
 * @param {string} params.originalTitle - The original headline
 * @param {string} params.content - Article content/summary
 * @param {Object} params.metadata - Additional metadata (location, actors, etc.)
 * @returns {Promise<string>} Enhanced headline or original if enhancement fails
 */
export async function enhanceHeadline({ originalTitle, content, metadata = {} }) {
  try {
    // Skip enhancement for already good headlines
    if (isHeadlineAlreadyGood(originalTitle)) {
      return originalTitle;
    }

    const context = `
Original Headline: ${originalTitle}
Content: ${content || 'No content available'}
${metadata.location ? `Location: ${metadata.location}` : ''}
${metadata.actors ? `Actors: ${metadata.actors.join(', ')}` : ''}
${metadata.eventType ? `Event Type: ${metadata.eventType}` : ''}
`;

    const response = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ENHANCEMENT_PROMPT
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    const enhancedHeadline = response.choices[0].message.content.trim();
    
    // Validate the enhanced headline
    if (enhancedHeadline && enhancedHeadline.length > 10 && enhancedHeadline.length < 200) {
      return enhancedHeadline;
    }
    
    return originalTitle;
  } catch (error) {
    console.error('[HeadlineEnhancer] Error enhancing headline:', error.message);
    return originalTitle; // Fallback to original
  }
}

/**
 * Check if a headline already contains good conflict information
 */
function isHeadlineAlreadyGood(headline) {
  // Check for action verbs
  const actionVerbs = [
    'strikes', 'kills', 'attacks', 'launches', 'fires', 'bombs', 'raids',
    'captures', 'destroys', 'shoots', 'intercepts', 'targets', 'evacuates'
  ];
  
  const headlineLower = headline.toLowerCase();
  const hasActionVerb = actionVerbs.some(verb => headlineLower.includes(verb));
  
  // Check for specific numbers
  const hasNumbers = /\d+/.test(headline);
  
  // Check for specific actors (not just country names)
  const hasSpecificActors = /(forces|military|army|missiles?|rockets?|drone|troops)/i.test(headline);
  
  return hasActionVerb && (hasNumbers || hasSpecificActors);
}

/**
 * Batch enhance multiple headlines
 * @param {Array} items - Array of items with title and content
 * @returns {Promise<Array>} Items with enhanced titles
 */
export async function batchEnhanceHeadlines(items) {
  const enhancedItems = [];
  
  // Process in small batches to avoid rate limits
  const batchSize = 5;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const enhancements = await Promise.allSettled(
      batch.map(item => enhanceHeadline({
        originalTitle: item.title,
        content: item.summary || item.content,
        metadata: {
          location: item.country || item.location,
          actors: item.participants || item.actors,
          eventType: item.event_type || item.conflict_type
        }
      }))
    );
    
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      if (enhancements[j].status === 'fulfilled') {
        enhancedItems.push({
          ...item,
          title: enhancements[j].value,
          original_title: item.title !== enhancements[j].value ? item.title : undefined
        });
      } else {
        enhancedItems.push(item); // Keep original on failure
      }
    }
    
    // Rate limiting between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return enhancedItems;
}

// Export for use in ingestion pipelines
export default {
  enhanceHeadline,
  batchEnhanceHeadlines
};