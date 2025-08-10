const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize OpenAI client (will use OPENAI_API_KEY from environment)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
} catch (error) {
  console.log('⚠️ OpenAI not configured, will use fallback summarization');
}

// Phase 3: LLM-powered headline summarization
async function generateSummary(headline, description = '') {
  if (!openai) {
    return null; // Will trigger fallback
  }
  
  try {
    const prompt = `Summarize this conflict news headline in 1-2 sentences with a focus on who is involved, what happened, and geopolitical implications. Be concise and factual.

Headline: "${headline}"
${description ? `Description: "${description}"` : ''}

Summary:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a geopolitical analyst specializing in conflict summarization. Provide clear, concise summaries that highlight the key actors, events, and implications.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI API error:', error.message);
    return null;
  }
}

// Fallback: Rule-based summarization if OpenAI fails
function generateFallbackSummary(headline, country, region, escalationScore) {
  const actors = [];
  const events = [];
  const implications = [];

  // Extract actors
  if (country) actors.push(country);
  if (headline.toLowerCase().includes('nato')) actors.push('NATO');
  if (headline.toLowerCase().includes('un ')) actors.push('UN');

  // Extract events
  if (headline.toLowerCase().includes('airstrike')) events.push('conducted airstrikes');
  if (headline.toLowerCase().includes('missile')) events.push('launched missiles');
  if (headline.toLowerCase().includes('attack')) events.push('carried out attacks');
  if (headline.toLowerCase().includes('ceasefire')) events.push('declared ceasefire');
  if (headline.toLowerCase().includes('peace')) events.push('pursued peace negotiations');

  // Determine implications based on escalation score
  if (escalationScore >= 7) {
    implications.push('escalating regional tensions');
  } else if (escalationScore >= 4) {
    implications.push('raising security concerns');
  } else if (escalationScore <= 1) {
    implications.push('potentially reducing tensions');
  }

  const actorText = actors.length > 0 ? actors.join(' and ') : 'Multiple parties';
  const eventText = events.length > 0 ? events[0] : 'engaged in conflict-related activities';
  const implicationText = implications.length > 0 ? implications[0] : 'affecting regional stability';

  return `${actorText} ${eventText} in ${region || 'the region'}, ${implicationText}.`;
}

// Main summarization function
async function summarizeNewsArticles() {
  console.log('🧠 Starting LLM-powered news summarization...');
  console.log(`📅 ${new Date().toISOString()}`);

  try {
    // Get articles that need summarization (high-priority first)
    const { data: articles, error } = await supabase
      .from('news')
      .select('id, headline, summary, country, region, escalation_score')
      .is('summary', null)
      .gte('escalation_score', 3) // Focus on medium to high intensity articles
      .order('escalation_score', { ascending: false })
      .limit(10); // Process in batches to avoid rate limits

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!articles || articles.length === 0) {
      console.log('✅ No articles need summarization');
      return;
    }

    console.log(`📄 Found ${articles.length} articles to summarize`);

    let successCount = 0;
    let fallbackCount = 0;

    for (const article of articles) {
      console.log(`\n🔄 Processing: "${article.headline.substring(0, 60)}..."`);
      
      let summary = null;

      // Try OpenAI first (if available)
      if (openai) {
        summary = await generateSummary(article.headline);
        
        if (summary) {
          console.log(`🤖 LLM Summary: ${summary}`);
        } else {
          console.log('⚠️ LLM failed, using fallback...');
        }
      }

      // Use fallback if LLM failed or no API key
      if (!summary) {
        summary = generateFallbackSummary(
          article.headline,
          article.country,
          article.region,
          article.escalation_score
        );
        fallbackCount++;
        console.log(`🔧 Fallback Summary: ${summary}`);
      } else {
        successCount++;
      }

      // Update article with summary
      const { error: updateError } = await supabase
        .from('news')
        .update({ summary })
        .eq('id', article.id);

      if (updateError) {
        console.error(`❌ Failed to update article ${article.id}:`, updateError);
      } else {
        console.log(`✅ Updated article with summary`);
      }

      // Rate limiting: wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 Summarization completed:`);
    console.log(`   🤖 LLM summaries: ${successCount}`);
    console.log(`   🔧 Fallback summaries: ${fallbackCount}`);
    console.log(`   📝 Total processed: ${successCount + fallbackCount}`);

  } catch (error) {
    console.error('💥 Summarization failed:', error);
  }
}

// Test function for specific headlines
async function testSummarization() {
  console.log('🧪 Testing summarization with sample headlines...');

  const testHeadlines = [
    {
      headline: 'Israeli airstrike hits Gaza hospital, dozens dead',
      country: 'Israel',
      region: 'Middle East',
      escalation_score: 8
    },
    {
      headline: 'Ukraine reports massive Russian missile attack on Kiev',
      country: 'Ukraine', 
      region: 'Europe',
      escalation_score: 7
    },
    {
      headline: 'Sudan peace agreement signed after months of negotiations',
      country: 'Sudan',
      region: 'Africa', 
      escalation_score: 0
    }
  ];

  for (const article of testHeadlines) {
    console.log(`\n📰 "${article.headline}"`);
    
    let summary = null;
    
    if (openai) {
      summary = await generateSummary(article.headline);
      console.log(`🤖 LLM: ${summary || 'Failed'}`);
    } else {
      console.log('🤖 LLM: Not configured (set OPENAI_API_KEY)');
    }
    
    const fallback = generateFallbackSummary(
      article.headline,
      article.country,
      article.region,
      article.escalation_score
    );
    console.log(`🔧 Fallback: ${fallback}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Main execution
if (require.main === module) {
  const isTestMode = process.argv.includes('--test');

  if (isTestMode) {
    testSummarization()
      .then(() => {
        console.log('🎉 Summarization testing completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Testing failed:', error);
        process.exit(1);
      });
  } else {
    summarizeNewsArticles()
      .then(() => {
        console.log('🎉 News summarization finished successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 News summarization failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { 
  summarizeNewsArticles, 
  generateSummary, 
  generateFallbackSummary 
};