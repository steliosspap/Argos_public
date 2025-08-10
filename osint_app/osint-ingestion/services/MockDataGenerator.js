/**
 * Mock Data Generator for Enhanced Pipeline Demo
 * Generates realistic conflict news data for testing
 */

export class MockDataGenerator {
  constructor() {
    this.mockArticles = [
      {
        title: "Russia Launches Overnight Missile Attack on Ukraine, 5 Killed in Kyiv",
        snippet: "Russian forces launched a barrage of missiles and drones overnight targeting multiple Ukrainian cities. At least 5 civilians were killed in Kyiv when a missile struck a residential building.",
        content: "Russian forces launched a barrage of missiles and drones overnight targeting multiple Ukrainian cities. At least 5 civilians were killed in Kyiv when a missile struck a residential building. Ukrainian air defenses shot down 30 of 40 missiles according to military officials.",
        source: "Reuters",
        author: "John Smith",
        publishedDate: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        url: "https://example.com/ukraine-attack-1"
      },
      {
        title: "Ukrainian Forces Report 5 Dead After Russian Strike on Capital",
        snippet: "Ukraine's emergency services reported 5 casualties after Russian missiles hit residential areas in Kyiv early this morning. The attack involved approximately 40 missiles.",
        content: "Full article content about the attack with more details...",
        source: "Associated Press",
        author: "Jane Doe",
        publishedDate: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        url: "https://example.com/ukraine-attack-2"
      },
      {
        title: "Analysis: Russia's Latest Missile Campaign Shows Shift in Strategy",
        snippet: "Military analysts believe Russia's overnight attacks demonstrate a new phase in their campaign. This opinion piece examines the strategic implications.",
        content: "Opinion piece content analyzing the strategic implications...",
        source: "CNN",
        author: "Defense Analyst",
        publishedDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        url: "https://example.com/analysis-1"
      },
      {
        title: "Israeli Military Operations Continue in Gaza, 12 Palestinians Killed",
        snippet: "Israeli Defense Forces conducted operations in northern Gaza overnight. Palestinian health officials report 12 killed including 4 children.",
        content: "Detailed content about Gaza operations...",
        source: "BBC News",
        author: "Middle East Correspondent",
        publishedDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        url: "https://example.com/gaza-1"
      },
      {
        title: "Hamas Fires Rockets at Southern Israel, IDF Responds with Airstrikes",
        snippet: "Hamas militants fired a barrage of rockets toward southern Israel on Tuesday. The Israeli military responded with airstrikes on Gaza.",
        content: "Full article about the exchange of fire...",
        source: "Times of Israel",
        author: "Security Reporter",
        publishedDate: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        url: "https://example.com/israel-hamas-1"
      },
      {
        title: "Syria: Clashes in Aleppo Province Leave 15 Dead",
        snippet: "Fighting between Syrian government forces and rebel groups in Aleppo province has left at least 15 people dead according to monitoring groups.",
        content: "Details about the Syrian conflict...",
        source: "Al Jazeera",
        author: "Syria Correspondent",
        publishedDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        url: "https://example.com/syria-1"
      },
      {
        title: "UN Reports 6 Civilians Killed in Russian Attack on Kyiv",
        snippet: "The United Nations Human Rights Office confirmed 6 civilian deaths from last night's Russian missile attack on Ukraine's capital.",
        content: "UN report details...",
        source: "United Nations News",
        author: "UN Press",
        publishedDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        url: "https://example.com/un-ukraine-1"
      },
      {
        title: "Breaking: Explosion in Damascus Kills Senior Military Official",
        snippet: "A car bomb explosion in Damascus has killed a senior Syrian military official and 3 bodyguards, state media reports.",
        content: "Breaking news content...",
        source: "Reuters",
        author: "Damascus Bureau",
        publishedDate: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        url: "https://example.com/damascus-1"
      },
      {
        title: "Yemen: Saudi Coalition Airstrikes Hit Sanaa, 8 Casualties Reported",
        snippet: "Saudi-led coalition airstrikes targeted Houthi positions in Yemen's capital Sanaa. Local sources report 8 casualties.",
        content: "Yemen conflict details...",
        source: "AFP",
        author: "Yemen Reporter",
        publishedDate: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        url: "https://example.com/yemen-1"
      },
      {
        title: "Editorial: The Humanitarian Cost of Ongoing Conflicts",
        snippet: "This editorial examines the civilian toll of current global conflicts and argues for increased diplomatic efforts.",
        content: "Editorial opinion content...",
        source: "The Guardian",
        author: "Editorial Board",
        publishedDate: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
        url: "https://example.com/editorial-1"
      }
    ];
    
    this.queryIndex = 0;
  }
  
  /**
   * Generate mock articles for a query
   */
  getMockArticles(query, limit = 5) {
    // Rotate through mock articles
    const articles = [];
    const startIndex = (this.queryIndex * 2) % this.mockArticles.length;
    
    for (let i = 0; i < limit && i < this.mockArticles.length; i++) {
      const index = (startIndex + i) % this.mockArticles.length;
      const mockArticle = this.mockArticles[index];
      
      // Clone and modify the article to match the query somewhat
      articles.push({
        ...mockArticle,
        searchQuery: query,
        // Add some variety to timestamps
        publishedDate: new Date(mockArticle.publishedDate.getTime() + (i * 60 * 60 * 1000))
      });
    }
    
    this.queryIndex++;
    return articles;
  }
  
  /**
   * Generate realistic extraction results
   */
  generateExtractionResults(article) {
    // Map of expected extractions based on article content
    const extractionMap = {
      'ukraine': {
        entities: [
          { text: 'Russia', type: 'ORGANIZATION', normalized: 'Russia' },
          { text: 'Ukraine', type: 'LOCATION', normalized: 'Ukraine' },
          { text: 'Kyiv', type: 'LOCATION', normalized: 'Kyiv' },
          { text: 'Russian forces', type: 'GROUP', normalized: 'Russian Military' },
          { text: '5 killed', type: 'CASUALTY', value: 5, subtype: 'killed' }
        ],
        temporalData: {
          timestamp: article.publishedDate,
          precision: 'hour',
          confidence: 0.9
        },
        facts: [
          { type: 'casualty', claim: '5 civilians killed', value: 5, confidence: 0.8 },
          { type: 'location', claim: 'Kyiv', confidence: 0.9 }
        ]
      },
      'gaza': {
        entities: [
          { text: 'Israel', type: 'LOCATION', normalized: 'Israel' },
          { text: 'Gaza', type: 'LOCATION', normalized: 'Gaza' },
          { text: 'IDF', type: 'ORGANIZATION', normalized: 'Israel Defense Forces' },
          { text: 'Hamas', type: 'ORGANIZATION', normalized: 'Hamas' },
          { text: '12 killed', type: 'CASUALTY', value: 12, subtype: 'killed' }
        ],
        temporalData: {
          timestamp: article.publishedDate,
          precision: 'day',
          confidence: 0.8
        },
        facts: [
          { type: 'casualty', claim: '12 Palestinians killed', value: 12, confidence: 0.7 },
          { type: 'participant', claim: 'Israeli military', confidence: 0.9 }
        ]
      }
    };
    
    // Determine which extraction to use based on content
    const content = article.title.toLowerCase() + ' ' + article.snippet.toLowerCase();
    
    if (content.includes('ukraine') || content.includes('russia')) {
      return extractionMap.ukraine;
    } else if (content.includes('gaza') || content.includes('israel')) {
      return extractionMap.gaza;
    }
    
    // Default extraction
    return {
      entities: [
        { text: 'Conflict', type: 'EVENT', normalized: 'Armed Conflict' }
      ],
      temporalData: {
        timestamp: article.publishedDate,
        precision: 'day',
        confidence: 0.7
      },
      facts: []
    };
  }
}