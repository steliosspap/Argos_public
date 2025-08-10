const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Phase 3: Escalation alert notification system
async function sendSlackAlert(article) {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!slackWebhookUrl) {
    console.log('⚠️ No Slack webhook URL configured');
    return false;
  }

  try {
    const escalationEmoji = getEscalationEmoji(article.escalation_score);
    const urgencyLevel = getUrgencyLevel(article.escalation_score);
    
    const message = {
      text: `${escalationEmoji} ${urgencyLevel} Conflict Alert`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${escalationEmoji} ${urgencyLevel} Conflict Alert`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Headline:*\n${article.headline}`
            },
            {
              type: "mrkdwn", 
              text: `*Source:*\n${article.source}`
            },
            {
              type: "mrkdwn",
              text: `*Region:*\n${article.region || 'Unknown'}`
            },
            {
              type: "mrkdwn",
              text: `*Country:*\n${article.country || 'Unknown'}`
            },
            {
              type: "mrkdwn",
              text: `*Escalation Score:*\n${article.escalation_score}/10`
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(article.date).toLocaleString()}`
            }
          ]
        }
      ]
    };

    if (article.summary) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Summary:*\n${article.summary}`
        }
      });
    }

    if (article.url) {
      message.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${article.url}|Read Full Article>`
        }
      });
    }

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log('✅ Slack alert sent successfully');
      return true;
    } else {
      console.error('❌ Slack alert failed:', response.statusText);
      return false;
    }

  } catch (error) {
    console.error('❌ Slack alert error:', error.message);
    return false;
  }
}

// Send email alert (using a simple approach)
async function sendEmailAlert(article) {
  const alertEmail = process.env.ALERT_EMAIL;
  
  if (!alertEmail) {
    console.log('⚠️ No alert email configured');
    return false;
  }

  // For now, just log the alert - could integrate with Resend, SendGrid, etc.
  console.log(`📧 Email alert would be sent to: ${alertEmail}`);
  console.log(`Subject: 🚨 High-Intensity Conflict Alert - ${article.country || article.region}`);
  console.log(`Body: ${article.headline} (Score: ${article.escalation_score}/10)`);
  
  return true;
}

// Console alert for testing
function sendConsoleAlert(article) {
  const escalationEmoji = getEscalationEmoji(article.escalation_score);
  const urgencyLevel = getUrgencyLevel(article.escalation_score);
  
  console.log('\n' + '🚨'.repeat(20));
  console.log(`${escalationEmoji} ${urgencyLevel.toUpperCase()} CONFLICT ALERT ${escalationEmoji}`);
  console.log('🚨'.repeat(20));
  console.log(`📰 Headline: ${article.headline}`);
  console.log(`🌍 Location: ${article.country || 'Unknown'}, ${article.region || 'Unknown'}`);
  console.log(`📊 Source: ${article.source}`);
  console.log(`🔥 Escalation Score: ${article.escalation_score}/10`);
  console.log(`⏰ Time: ${new Date(article.date).toLocaleString()}`);
  
  if (article.summary) {
    console.log(`📝 Summary: ${article.summary}`);
  }
  
  if (article.url) {
    console.log(`🔗 URL: ${article.url}`);
  }
  
  console.log('🚨'.repeat(20) + '\n');
  
  return true;
}

// Helper functions
function getEscalationEmoji(score) {
  if (score >= 9) return '🔴';
  if (score >= 7) return '🟠'; 
  if (score >= 5) return '🟡';
  return '🔵';
}

function getUrgencyLevel(score) {
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH-INTENSITY';
  if (score >= 5) return 'MEDIUM-INTENSITY';
  return 'LOW-INTENSITY';
}

// Main alert function
async function sendAlert(article) {
  const alertsEnabled = process.env.ALERTS_ENABLED !== 'false';
  const minAlertScore = parseInt(process.env.MIN_ALERT_SCORE || '7');
  
  if (!alertsEnabled) {
    console.log('🔕 Alerts disabled via environment variable');
    return false;
  }

  if (article.escalation_score < minAlertScore) {
    console.log(`⬇️ Article score ${article.escalation_score} below alert threshold ${minAlertScore}`);
    return false;
  }

  console.log(`🚨 Triggering alert for high-intensity article (Score: ${article.escalation_score})`);

  const results = await Promise.allSettled([
    sendConsoleAlert(article),
    sendSlackAlert(article),
    sendEmailAlert(article)
  ]);

  const successCount = results.filter(result => 
    result.status === 'fulfilled' && result.value
  ).length;

  console.log(`📤 Alert sent via ${successCount} channel(s)`);
  return successCount > 0;
}

// Check for recent high-intensity articles and send alerts
async function checkForAlerts() {
  console.log('🔍 Checking for high-intensity articles requiring alerts...');

  try {
    // Get recent high-intensity articles from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const minScore = parseInt(process.env.MIN_ALERT_SCORE || '7');

    const { data: articles, error } = await supabase
      .from('news')
      .select('*')
      .gte('escalation_score', minScore)
      .gte('created_at', oneHourAgo)
      .order('escalation_score', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!articles || articles.length === 0) {
      console.log('✅ No high-intensity articles found');
      return;
    }

    console.log(`⚠️ Found ${articles.length} high-intensity article(s)`);

    for (const article of articles) {
      await sendAlert(article);
      // Small delay between alerts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('💥 Alert check failed:', error);
  }
}

// Test alert system
async function testAlerts() {
  console.log('🧪 Testing alert system with sample data...');

  const testArticle = {
    headline: 'Major Israeli airstrike hits Gaza hospital, dozens killed in escalation',
    source: 'BBC World News',
    country: 'Israel',
    region: 'Middle East',
    escalation_score: 8,
    date: new Date().toISOString(),
    summary: 'An Israeli airstrike struck a hospital in Gaza, resulting in multiple civilian casualties and raising concerns over humanitarian law violations.',
    url: 'https://example.com/test-article'
  };

  await sendAlert(testArticle);
}

// Main execution
if (require.main === module) {
  const isTestMode = process.argv.includes('--test');

  if (isTestMode) {
    testAlerts()
      .then(() => {
        console.log('🎉 Alert testing completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Alert testing failed:', error);
        process.exit(1);
      });
  } else {
    checkForAlerts()
      .then(() => {
        console.log('🎉 Alert check completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Alert check failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { 
  sendAlert, 
  sendSlackAlert, 
  sendEmailAlert, 
  sendConsoleAlert,
  checkForAlerts 
};