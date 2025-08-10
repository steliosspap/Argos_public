/**
 * Enhanced Query Generator
 * Generates comprehensive search queries using subjects × modifiers approach
 */

export class QueryGenerator {
  constructor() {
    // Conflict subjects from Global Conflict Tracker
    this.conflictSubjects = {
      countries: [
        { name: 'Ukraine', modifiers: ['Russia', 'war', 'invasion', 'conflict'] },
        { name: 'Russia', modifiers: ['Ukraine', 'military', 'operation', 'sanctions'] },
        { name: 'Israel', modifiers: ['Palestine', 'Gaza', 'Hamas', 'conflict'] },
        { name: 'Palestine', modifiers: ['Israel', 'Gaza', 'West Bank', 'conflict'] },
        { name: 'Syria', modifiers: ['civil war', 'Assad', 'rebels', 'ISIS'] },
        { name: 'Yemen', modifiers: ['Houthis', 'Saudi', 'conflict', 'humanitarian'] },
        { name: 'Afghanistan', modifiers: ['Taliban', 'conflict', 'terrorism'] },
        { name: 'Iran', modifiers: ['nuclear', 'Israel', 'sanctions', 'military'] },
        { name: 'China', modifiers: ['Taiwan', 'South China Sea', 'military'] },
        { name: 'Taiwan', modifiers: ['China', 'independence', 'military', 'conflict'] },
        { name: 'Ethiopia', modifiers: ['Tigray', 'conflict', 'humanitarian'] },
        { name: 'Myanmar', modifiers: ['military', 'coup', 'Rohingya', 'conflict'] },
        { name: 'Sudan', modifiers: ['Darfur', 'conflict', 'military', 'coup'] },
        { name: 'Somalia', modifiers: ['Al-Shabaab', 'terrorism', 'conflict'] },
        { name: 'Libya', modifiers: ['civil war', 'militias', 'conflict'] },
        { name: 'Mali', modifiers: ['terrorism', 'France', 'military', 'coup'] },
        { name: 'Niger', modifiers: ['coup', 'military', 'France', 'ECOWAS'] },
        { name: 'Lebanon', modifiers: ['Hezbollah', 'Israel', 'conflict', 'crisis'] },
        { name: 'Iraq', modifiers: ['ISIS', 'militias', 'US', 'Iran'] },
        { name: 'Pakistan', modifiers: ['terrorism', 'military', 'Kashmir', 'Taliban'] }
      ],
      
      regions: [
        { name: 'Gaza', modifiers: ['Israel', 'Hamas', 'war', 'humanitarian'] },
        { name: 'West Bank', modifiers: ['Israel', 'Palestine', 'settlers', 'violence'] },
        { name: 'Donbas', modifiers: ['Ukraine', 'Russia', 'war', 'conflict'] },
        { name: 'Crimea', modifiers: ['Ukraine', 'Russia', 'occupation', 'conflict'] },
        { name: 'Kashmir', modifiers: ['India', 'Pakistan', 'conflict', 'military'] },
        { name: 'Xinjiang', modifiers: ['China', 'Uyghur', 'human rights', 'camps'] },
        { name: 'Tigray', modifiers: ['Ethiopia', 'conflict', 'humanitarian', 'war'] },
        { name: 'Darfur', modifiers: ['Sudan', 'conflict', 'genocide', 'militia'] },
        { name: 'Sahel', modifiers: ['terrorism', 'military', 'France', 'coup'] },
        { name: 'South China Sea', modifiers: ['China', 'dispute', 'military', 'naval'] }
      ],
      
      organizations: [
        { name: 'NATO', modifiers: ['Russia', 'Ukraine', 'expansion', 'military'] },
        { name: 'Hamas', modifiers: ['Israel', 'Gaza', 'rockets', 'terrorism'] },
        { name: 'Hezbollah', modifiers: ['Lebanon', 'Israel', 'Iran', 'conflict'] },
        { name: 'Taliban', modifiers: ['Afghanistan', 'terrorism', 'government'] },
        { name: 'ISIS', modifiers: ['terrorism', 'Syria', 'Iraq', 'attack'] },
        { name: 'Al-Qaeda', modifiers: ['terrorism', 'attack', 'threat'] },
        { name: 'Wagner Group', modifiers: ['Russia', 'mercenary', 'Africa', 'Ukraine'] },
        { name: 'Al-Shabaab', modifiers: ['Somalia', 'terrorism', 'attack'] },
        { name: 'Houthis', modifiers: ['Yemen', 'Iran', 'Saudi', 'missiles'] },
        { name: 'PKK', modifiers: ['Turkey', 'Kurdistan', 'terrorism', 'conflict'] }
      ]
    };
    
    // Action modifiers for comprehensive coverage
    this.actionModifiers = [
      'attack', 'strike', 'assault', 'offensive',
      'killed', 'casualties', 'death toll', 'wounded',
      'bombing', 'airstrike', 'missile', 'rocket',
      'invasion', 'incursion', 'advance', 'retreat',
      'ceasefire', 'peace talks', 'negotiations', 'agreement',
      'sanctions', 'embargo', 'blockade', 'siege',
      'humanitarian crisis', 'refugees', 'displacement',
      'war crimes', 'genocide', 'ethnic cleansing',
      'coup', 'uprising', 'protest', 'unrest',
      'terrorism', 'extremism', 'radicalization'
    ];
    
    // Temporal modifiers
    this.temporalModifiers = [
      'today', 'yesterday', 'this week', 'latest',
      'breaking', 'ongoing', 'escalation', 'update'
    ];
  }
  
  /**
   * Generate all search query combinations
   * Target: ~500 queries from ~50 subjects
   */
  generateAllQueries() {
    const queries = [];
    const queryMetadata = [];
    
    // Process countries
    this.conflictSubjects.countries.forEach(subject => {
      subject.modifiers.forEach(modifier => {
        // Basic combination
        queries.push({
          query: `${subject.name} ${modifier}`,
          type: 'subject_modifier',
          subject: subject.name,
          modifier: modifier,
          category: 'country'
        });
        
        // Add temporal variants for recent events
        this.temporalModifiers.slice(0, 2).forEach(temporal => {
          queries.push({
            query: `${subject.name} ${modifier} ${temporal}`,
            type: 'subject_modifier_temporal',
            subject: subject.name,
            modifier: modifier,
            temporal: temporal,
            category: 'country'
          });
        });
      });
      
      // Add action-based queries
      this.actionModifiers.slice(0, 5).forEach(action => {
        queries.push({
          query: `${subject.name} ${action}`,
          type: 'subject_action',
          subject: subject.name,
          action: action,
          category: 'country'
        });
      });
    });
    
    // Process regions
    this.conflictSubjects.regions.forEach(subject => {
      subject.modifiers.forEach(modifier => {
        queries.push({
          query: `${subject.name} ${modifier}`,
          type: 'subject_modifier',
          subject: subject.name,
          modifier: modifier,
          category: 'region'
        });
      });
    });
    
    // Process organizations
    this.conflictSubjects.organizations.forEach(subject => {
      subject.modifiers.forEach(modifier => {
        queries.push({
          query: `${subject.name} ${modifier}`,
          type: 'subject_modifier',
          subject: subject.name,
          modifier: modifier,
          category: 'organization'
        });
      });
    });
    
    // Add broad conflict queries
    const broadQueries = [
      'international conflict today',
      'military action latest',
      'casualties war update',
      'peace talks negotiations',
      'humanitarian crisis latest',
      'terrorism attack today',
      'civil war update',
      'military coup latest'
    ];
    
    broadQueries.forEach(query => {
      queries.push({
        query: query,
        type: 'broad_search',
        category: 'general'
      });
    });
    
    return queries;
  }
  
  /**
   * Generate targeted queries based on extracted events
   */
  generateTargetedQueries(event) {
    const queries = [];
    
    // Location-based targeted searches
    if (event.locationName) {
      queries.push({
        query: `${event.locationName} ${event.eventType} update`,
        type: 'targeted_research',
        parent_event_id: event.id,
        focus: 'location'
      });
      
      queries.push({
        query: `${event.locationName} casualties ${new Date(event.timestamp).toLocaleDateString()}`,
        type: 'targeted_research',
        parent_event_id: event.id,
        focus: 'casualties'
      });
    }
    
    // Actor-based targeted searches
    if (event.participants && event.participants.length > 0) {
      event.participants.forEach(actor => {
        queries.push({
          query: `${actor} ${event.locationName || ''} conflict`,
          type: 'targeted_research',
          parent_event_id: event.id,
          focus: 'actor'
        });
      });
    }
    
    // Event-type specific searches
    const eventTypeQueries = {
      'military_action': ['military operation', 'armed forces', 'combat'],
      'bombing': ['airstrike', 'explosion', 'missile strike'],
      'terrorism': ['terrorist attack', 'extremist', 'bombing'],
      'protest': ['demonstration', 'unrest', 'uprising'],
      'humanitarian': ['refugees', 'displacement', 'aid']
    };
    
    const typeQueries = eventTypeQueries[event.eventType] || ['incident', 'event'];
    typeQueries.forEach(typeQuery => {
      queries.push({
        query: `${event.locationName || event.country} ${typeQuery} ${new Date(event.timestamp).toLocaleDateString()}`,
        type: 'targeted_research',
        parent_event_id: event.id,
        focus: 'event_type'
      });
    });
    
    return queries;
  }
  
  /**
   * Get active conflict subjects from database
   */
  async getActiveSubjects(supabase) {
    const { data: subjects } = await supabase
      .from('conflict_subjects')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });
    
    return subjects || [];
  }
  
  /**
   * Score query effectiveness based on results
   */
  calculateQueryEffectiveness(query, resultsCount, relevantCount) {
    if (resultsCount === 0) return 0;
    
    const relevanceRate = relevantCount / resultsCount;
    const coverageScore = Math.min(resultsCount / 10, 1); // Normalize to 10 results
    
    return (relevanceRate * 0.7 + coverageScore * 0.3);
  }
}