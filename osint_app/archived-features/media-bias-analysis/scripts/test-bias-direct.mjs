/**
 * Direct test of bias detection modules
 * Run with: node scripts/test-bias-direct.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

console.log('🧪 Testing Bias Detection System Directly...\n');

// Simple bias detection test
async function testBiasDetection() {
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  });

  const testArticles = [
    {
      title: "Government Announces New Policy",
      content: "The government today announced a new policy that aims to address economic concerns. Officials say the measure will help citizens, though critics argue it may have unintended consequences.",
      expectedBias: "center"
    },
    {
      title: "Radical Extremists Push Dangerous Agenda",
      content: "Far-left socialist extremists are destroying our country with their radical agenda. These dangerous policies will ruin everything we've built. Patriots must stand up against this threat to our freedom!",
      expectedBias: "right"
    },
    {
      title: "Corporate Fascists Destroy Democracy",
      content: "Once again, corporate fascists and their right-wing puppets block progress. These greedy capitalists care only about profits while workers suffer. The system is rigged against the people!",
      expectedBias: "left"
    }
  ];

  for (const article of testArticles) {
    console.log(`\n📰 Testing: "${article.title}"`);
    console.log(`   Expected bias: ${article.expectedBias}`);
    
    try {
      const prompt = `Analyze this news article for political bias. Rate from -5 (far left) to +5 (far right).

Article:
Title: ${article.title}
Content: ${article.content}

Provide a JSON response with:
- biasScore: number from -5 to 5
- biasCategory: "far-left", "left", "lean-left", "center", "lean-right", "right", or "far-right"
- confidence: 0 to 1
- reasoning: brief explanation`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      console.log(`   ✅ Analysis result:`);
      console.log(`      • Bias Score: ${result.biasScore}`);
      console.log(`      • Category: ${result.biasCategory}`);
      console.log(`      • Confidence: ${Math.round(result.confidence * 100)}%`);
      console.log(`      • Reasoning: ${result.reasoning}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

// Test fact-checking with Google Search
async function testFactChecking() {
  console.log('\n\n🔍 Testing Fact-Checking (Google Search)...\n');
  
  const testQuery = "climate change Paris Agreement 2015";
  const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(testQuery)}&num=3`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items) {
      console.log(`   ✅ Found ${data.items.length} search results for: "${testQuery}"`);
      data.items.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        console.log(`      ${item.link}`);
      });
    } else {
      console.log('   ❌ No search results found');
    }
  } catch (error) {
    console.error(`   ❌ Search error: ${error.message}`);
  }
}

// Run tests
console.log('🔧 Configuration:');
console.log(`   • OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
console.log(`   • API Keys: ${process.env.OPENAI_API_KEY ? '✅' : '❌'} OpenAI, ${process.env.GOOGLE_API_KEY ? '✅' : '❌'} Google`);

await testBiasDetection();
await testFactChecking();

console.log('\n\n✅ Direct testing complete!');
console.log('\n💡 To test the full system:');
console.log('   1. Start the Next.js server: npm run dev');
console.log('   2. Visit http://localhost:3000/intelligence-center');
console.log('   3. Look for bias indicators on news items');
console.log('   4. Or run: node scripts/test-bias-analysis.js (with server running)');