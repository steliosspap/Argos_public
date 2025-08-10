// Comprehensive global news sources for massive data ingestion
export const GLOBAL_NEWS_SOURCES = {
  // English-language international sources
  international: [
    // Major English sources
    'https://feeds.reuters.com/reuters/worldNews',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.cnn.com/rss/edition.rss',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://feeds.skynews.com/feeds/rss/world.xml',
    'https://feeds.npr.org/1004/rss.xml',
    'https://feeds.washingtonpost.com/rss/world',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://feeds.guardian.co.uk/theguardian/world/rss',
    'https://feeds.telegraph.co.uk/news/worldnews/rss',
    'https://feeds.dw.com/rss/en-world',
    'https://feeds.france24.com/en/international/rss',
    'https://www.euronews.com/rss?format=mrss',
    'https://feeds.breakingnews.ie/bninews',
    'https://feeds.afp.com/afp-en',
    
    // Defense and security focused
    'https://feeds.defensenews.com/defense-news/home',
    'https://janes.com/feeds/all',
    'https://feeds.military.com/military-news',
    'https://feeds.c4isrnet.com/c4isr-net/defense-technology',
    'https://feeds.armytimes.com/army-times/news',
    'https://feeds.navytimes.com/navy-times/news',
    'https://feeds.airforcetimes.com/air-force-times/news',
    'https://feeds.marinecorpstimes.com/marine-corps-times/news',
    
    // Intelligence and geopolitical
    'https://feeds.stratfor.com/worldview',
    'https://feeds.foreignpolicy.com/fp-rss',
    'https://feeds.foreignaffairs.com/articles',
    'https://feeds.chathamhouse.org/all',
    'https://feeds.cfr.org/publication',
    'https://feeds.csis.org/csis-analysis',
    'https://feeds.brookings.edu/brookings',
    'https://feeds.rand.org/rand',
  ],

  // Russian-language sources
  russian: [
    'https://lenta.ru/rss',
    'https://ria.ru/export/rss2/archive/index.xml',
    'https://tass.ru/rss/v2.xml',
    'https://www.gazeta.ru/export/rss/lenta.xml',
    'https://www.kommersant.ru/RSS/main.xml',
    'https://www.vedomosti.ru/rss/news',
    'https://www.rbc.ru/v10/ajax/get-news-feed/',
    'https://tvzvezda.ru/export/rss.xml',
    'https://iz.ru/xml/rss/all.xml',
    'https://regnum.ru/rss',
    'https://life.ru/xml/feed.xml',
    'https://www.mk.ru/rss/index.xml',
    'https://newsvl.ru/rss/',
    'https://www.dp.ru/RSS/',
    'https://topdialog.ru/rss/',
  ],

  // Chinese-language sources
  chinese: [
    'https://rss.xinhuanet.com/rss/world.xml',
    'https://rss.people.com.cn/index.xml',
    'https://news.sina.com.cn/rss/world.xml',
    'https://rss.sohu.com/rss/news.xml',
    'https://feed.china.com.cn/rss/news.xml',
    'https://feeds.chinadaily.com.cn/chinadaily/world.xml',
    'https://www.globaltimes.cn/rss/outbrain.xml',
    'https://english.cri.cn/rss/world.xml',
    'https://feeds.scmp.com/rss/91/feed',
    'https://feeds.feedburner.com/etaiwannews-english',
    'https://focustaiwan.tw/rss/aall.aspx',
  ],

  // Arabic-language sources
  arabic: [
    'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d85-c1278abeeb9b/73d0e1b4-532f-45ef-b135-a124d7dc72c9',
    'https://www.alarabiya.net/ar/rss.xml',
    'https://www.bbc.com/arabic/rss.xml',
    'https://feeds.skynewsarabia.com/feeds/rss/home.xml',
    'https://feeds.france24.com/france24/ar/news/rss',
    'https://www.dw.com/ar/rss',
    'https://arabic.rt.com/rss',
    'https://arabic.cnn.com/rss',
    'https://www.youm7.com/rss/SectionRss?SectionID=66',
    'https://www.ahram.org.eg/rss/ahram.xml',
    'https://www.masrawy.com/rss/rssfeeds',
    'https://www.alyaum.com/RSS/rss-news.xml',
    'https://sabq.org/rss.xml',
    'https://www.alriyadh.com/rss.xml',
    'https://www.okaz.com.sa/rss/all-news',
  ],

  // Spanish-language sources
  spanish: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    'https://www.elmundo.es/rss/internacional.xml',
    'https://feeds.lavanguardia.com/lavanguardia/internacional',
    'https://www.abc.es/rss/feeds/internacional.xml',
    'https://feeds.20minutos.es/internacional',
    'https://elpais.com/internacional/rss.xml',
    'https://feeds.clarin.com/mundo.xml',
    'https://www.lanacion.com.ar/mundo/rss',
    'https://feeds.ole.com.ar/rss/ultimomomento.xml',
    'https://www.telam.com.ar/rss2/ultimasnoticias.xml',
    'https://www.infobae.com/feeds/rss/',
    'https://feeds.perfil.com/perfil-internacional',
    'https://feeds.pagina12.com.ar/rss/internacional',
    'https://rss.eluniversal.com.mx/rss/internacional.xml',
    'https://feeds.milenio.com/internacional.xml',
    'https://www.reforma.com/rss/internacional.xml',
    'https://feeds.jornada.com.mx/internacional.xml',
  ],

  // French-language sources
  french: [
    'https://feeds.lemonde.fr/rss/une.xml',
    'https://feeds.lefigaro.fr/lefigaro/laune',
    'https://feeds.liberation.fr/rss/',
    'https://feeds.franceinter.fr/franceinter/titres',
    'https://feeds.france24.com/fr/international/rss',
    'https://feeds.rfi.fr/francais/actualite/rss',
    'https://feeds.leparisien.fr/leparisien/une',
    'https://feeds.lexpress.fr/express/actualites',
    'https://feeds.nouvelobs.com/rss/topstories',
    'https://feeds.mediapart.fr/articles/normal',
    'https://www.lepoint.fr/rss.xml',
    'https://feeds.lapresse.ca/rss/international.xml',
    'https://feeds.radio-canada.ca/nouvelles/international/rss',
    'https://feeds.lesechos.fr/rss/lesechos_monde.xml',
    'https://feeds.challenges.fr/rss/international.xml',
  ],

  // German-language sources
  german: [
    'https://feeds.spiegel.de/spiegel/international.rss',
    'https://feeds.welt.de/welt/politik.rss',
    'https://feeds.sueddeutsche.de/rss/Topthemen',
    'https://feeds.faz.net/faz-aktuell',
    'https://feeds.zeit.de/international/rss',
    'https://feeds.focus.de/politik',
    'https://feeds.stern.de/stern/politik',
    'https://feeds.handelsblatt.com/rss/politik',
    'https://feeds.tagesspiegel.de/tagesspiegel/politik/rss',
    'https://feeds.dw.com/rss/de-all',
    'https://feeds.tagesschau.de/tagesschau-newsticker-weltgeschehen',
    'https://feeds.n-tv.de/rss/politik.rss',
    'https://feeds.wiwo.de/rss/politik',
    'https://feeds.derstandard.at/rss/international',
    'https://feeds.diepresse.com/diepresse/aussenpolitik',
  ],

  // Italian-language sources
  italian: [
    'https://feeds.corriere.it/rss/editoriali.xml',
    'https://feeds.repubblica.it/rss/homepage/rss2.0.xml',
    'https://feeds.lastampa.it/rss/esteri.xml',
    'https://feeds.gazzetta.it/rss/homepage.xml',
    'https://feeds.ilsole24ore.com/rss/notizie--homepage.xml',
    'https://feeds.ilgiornale.it/rss/homepage.xml',
    'https://feeds.quotidiano.net/rss/esteri.xml',
    'https://feeds.liberoquotidiano.it/rss/homepage.xml',
    'https://feeds.huffingtonpost.it/rss',
    'https://feeds.fanpage.it/rss',
    'https://feeds.agi.it/rss/cronaca.xml',
    'https://feeds.adnkronos.com/rss/adnkronos.xml',
    'https://feeds.ansa.it/rss/ansait_notizie.xml',
    'https://feeds.tgcom24.mediaset.it/rss/esteri.xml',
    'https://feeds.rainews.it/rss/homepage.xml',
  ],

  // Portuguese-language sources
  portuguese: [
    'https://feeds.folha.uol.com.br/folha/mundo/rss091.xml',
    'https://feeds.estadao.com.br/rss/internacional.xml',
    'https://feeds.oglobo.globo.com/rss/mundo.xml',
    'https://feeds.uol.com.br/rss/ultnot/internacional.xml',
    'https://feeds.terra.com.br/rss/internacional.xml',
    'https://feeds.ig.com.br/rss/mundo.xml',
    'https://feeds.record.pt/rss/internacional',
    'https://feeds.dn.pt/rss/mundo',
    'https://feeds.publico.pt/rss/mundo',
    'https://feeds.cmjornal.pt/rss/internacional',
    'https://feeds.jn.pt/rss/mundo',
    'https://feeds.iol.pt/rss/internacional',
    'https://feeds.observador.pt/rss/mundo',
    'https://feeds.expresso.sapo.pt/rss/internacional',
    'https://feeds.rtp.pt/rss/mundo',
  ],

  // Japanese-language sources
  japanese: [
    'https://feeds.nhk.or.jp/nhk/news/rss.xml',
    'https://feeds.asahi.com/rss/asahi/international.rss',
    'https://feeds.yomiuri.co.jp/rss/news/world.xml',
    'https://feeds.mainichi.jp/rss/etc/mainichi-select.rss',
    'https://feeds.sankei.com/rss/news/world.xml',
    'https://feeds.tokyo-np.co.jp/rss/international.xml',
    'https://feeds.kyodo.co.jp/rss/news.xml',
    'https://feeds.nikkei.com/rss/DGXKZO.xml',
    'https://feeds.jiji.com/rss/news.xml',
    'https://feeds.tbs.co.jp/rss/news.xml',
    'https://feeds.fnn.jp/rss/news.xml',
    'https://feeds.tv-asahi.co.jp/rss/news.xml',
    'https://feeds.ntv.co.jp/rss/news.xml',
    'https://feeds.cyzo.com/rss/cyzo.xml',
    'https://feeds.livedoor.com/rss/news/topics',
  ],

  // Regional and conflict zones
  middle_east: [
    'https://feeds.haaretz.com/haaretz/news',
    'https://feeds.timesofisrael.com/rss/',
    'https://feeds.jpost.com/rss/rssfeedsheadlines',
    'https://feeds.ynet.co.il/rss/news.xml',
    'https://feeds.i24news.tv/rss/international',
    'https://feeds.rudaw.net/rss/english',
    'https://feeds.kurdistan24.net/rss',
    'https://feeds.turkishminute.com/rss',
    'https://feeds.dailysabah.com/rss',
    'https://feeds.hurriyetdailynews.com/rss',
    'https://feeds.todayszaman.com/rss',
    'https://feeds.iranwire.com/rss',
    'https://feeds.rferl.org/rss',
    'https://feeds.mei.edu/rss',
    'https://feeds.washingtoninstitute.org/rss',
  ],

  africa: [
    'https://feeds.africanews.com/rss',
    'https://feeds.allafrica.com/allafrica/headlines',
    'https://feeds.news24.com/articles/news24/topstories/rss',
    'https://feeds.mg.co.za/rss',
    'https://feeds.iol.co.za/rss/news',
    'https://feeds.citizen.co.za/rss',
    'https://feeds.ewn.co.za/rss',
    'https://feeds.timeslive.co.za/rss',
    'https://feeds.businessday.ng/rss',
    'https://feeds.premiumtimesng.com/rss',
    'https://feeds.punchng.com/rss',
    'https://feeds.vanguardngr.com/rss',
    'https://feeds.thecable.ng/rss',
    'https://feeds.dailytrust.com.ng/rss',
    'https://feeds.egypttoday.com/rss',
  ],

  asia_pacific: [
    'https://feeds.straitstimes.com/rss/news',
    'https://feeds.channelnewsasia.com/rss/news',
    'https://feeds.thejakartapost.com/rss',
    'https://feeds.bangkokpost.com/rss/news',
    'https://feeds.nationthailand.com/rss',
    'https://feeds.vietnamnews.vn/rss',
    'https://feeds.vnexpress.net/rss/news.rss',
    'https://feeds.philstar.com/rss/news',
    'https://feeds.mb.com.ph/rss',
    'https://feeds.gmanetwork.com/rss',
    'https://feeds.abs-cbn.com/rss',
    'https://feeds.inquirer.net/rss',
    'https://feeds.rappler.com/rss',
    'https://feeds.manilatimes.net/rss',
    'https://feeds.sunstar.com.ph/rss',
  ],
  
  // South Asian sources (NEW)
  south_asia: [
    // India
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://feeds.thehindu.com/news/international/rss',
    'https://indianexpress.com/feed/',
    'https://feeds.hindustantimes.com/rss/india',
    'https://feeds.ndtv.com/ndtvnews-india-news',
    'https://feeds.news18.com/news18/rss/india.xml',
    'https://feeds.indiatoday.in/in/rss',
    'https://feeds.republicworld.com/rss/india.xml',
    'https://feeds.wionews.com/feeds/wion-world.xml',
    'https://feeds.thewire.in/rss',
    
    // Pakistan
    'https://feeds.dawn.com/feeds/home',
    'https://feeds.thenews.com.pk/rss/news',
    'https://feeds.tribune.com.pk/pakistan/feed/',
    'https://feeds.geo.tv/rss/1/1',
    'https://feeds.nation.com.pk/rss/news',
    
    // Bangladesh
    'https://feeds.thedailystar.net/rss',
    'https://feeds.dhakatribune.com/rss',
    'https://feeds.bdnews24.com/rss/en/all',
    'https://feeds.newagebd.net/rss',
    
    // Sri Lanka
    'https://feeds.dailymirror.lk/rss',
    'https://feeds.ft.lk/rss',
    'https://feeds.island.lk/rss',
    
    // Nepal
    'https://feeds.kathmandupost.com/rss',
    'https://feeds.himalayantimes.com/rss',
    'https://feeds.onlinekhabar.com/rss',
    
    // Afghanistan
    'https://feeds.tolonews.com/rss',
    'https://feeds.pajhwok.com/rss',
    'https://feeds.khaama.com/rss',
  ],
  
  // Oceania sources (NEW)
  oceania: [
    // Australia
    'https://feeds.abc.net.au/news/feed',
    'https://feeds.smh.com.au/rss/world.xml',
    'https://feeds.theage.com.au/rss/world.xml',
    'https://feeds.news.com.au/public/rss/2.0/news_world_3356.xml',
    'https://feeds.theguardian.com/australia-news/rss',
    'https://feeds.theaustralian.com.au/rss/news',
    'https://feeds.skynews.com.au/feeds/rss/world.xml',
    'https://feeds.sbs.com.au/news/feed',
    
    // New Zealand
    'https://feeds.stuff.co.nz/rss/',
    'https://feeds.nzherald.co.nz/rss/xml/nzhrsscid_000000001.xml',
    'https://feeds.rnz.co.nz/news',
    'https://feeds.newshub.co.nz/rss',
    'https://feeds.tvnz.co.nz/rss',
    'https://feeds.odt.co.nz/rss',
    
    // Pacific Islands
    'https://feeds.fijitimes.com/rss',
    'https://feeds.fijisun.com.fj/rss',
    'https://feeds.rnz.co.nz/pacific',
    'https://feeds.pacificnews.org/rss',
    'https://feeds.islandsbusiness.com/rss',
  ],
  
  // Nordic sources (NEW)
  nordic: [
    // Sweden
    'https://feeds.svt.se/nyheter/rss.xml',
    'https://feeds.dn.se/nyheter',
    'https://feeds.svd.se/nyheter',
    'https://feeds.aftonbladet.se/rss2/small',
    
    // Norway
    'https://feeds.nrk.no/nyheter',
    'https://feeds.vg.no/nyheter',
    'https://feeds.aftenposten.no/rss',
    'https://feeds.dagbladet.no/rss',
    
    // Denmark
    'https://feeds.dr.dk/nyheder',
    'https://feeds.politiken.dk/rss',
    'https://feeds.berlingske.dk/nyheder',
    'https://feeds.tv2.dk/nyheder',
    
    // Finland
    'https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET',
    'https://feeds.hs.fi/rss',
    'https://feeds.iltalehti.fi/rss',
    'https://feeds.mtv.fi/rss',
    
    // Iceland
    'https://feeds.ruv.is/rss',
    'https://feeds.mbl.is/rss',
    'https://feeds.visir.is/rss',
  ],

  eastern_europe: [
    'https://feeds.kyivpost.com/rss',
    'https://feeds.unian.net/rss',
    'https://feeds.pravda.com.ua/rss',
    'https://feeds.interfax.com.ua/rss',
    'https://feeds.euromaidan.net/rss',
    'https://feeds.hromadske.ua/rss',
    'https://feeds.radiosvoboda.org/rss',
    'https://feeds.rferl.org/ukraine',
    'https://feeds.polsatnews.pl/rss',
    'https://feeds.tvn24.pl/rss',
    'https://feeds.gazeta.pl/rss',
    'https://feeds.wp.pl/rss',
    'https://feeds.onet.pl/rss',
    'https://feeds.interia.pl/rss',
    'https://feeds.rmf24.pl/rss',
  ],

  // Intelligence and defense specific
  defense_intelligence: [
    'https://feeds.defensenews.com/all',
    'https://feeds.janes.com/intelligence',
    'https://feeds.strategypage.com/rss',
    'https://feeds.militarytimes.com/defense',
    'https://feeds.warisboring.com/rss',
    'https://feeds.defenseone.com/rss',
    'https://feeds.breakingdefense.com/rss',
    'https://feeds.nationaldefensemagazine.org/rss',
    'https://feeds.armyrecognition.com/rss',
    'https://feeds.navalnews.com/rss',
    'https://feeds.flightglobal.com/rss',
    'https://feeds.theaviationist.com/rss',
    'https://feeds.alert5.com/rss',
    'https://feeds.scramble.nl/rss',
    'https://feeds.militaryaerospace.com/rss',
  ],

  // Conflict monitoring
  conflict_monitoring: [
    'https://feeds.acleddata.com/rss',
    'https://feeds.crisisgroup.org/rss',
    'https://feeds.csis.org/critical-questions',
    'https://feeds.sipri.org/rss',
    'https://feeds.smallwarsjournal.com/rss',
    'https://feeds.warontherocks.com/rss',
    'https://feeds.lawfareblog.com/rss',
    'https://feeds.longhorndefense.com/rss',
    'https://feeds.moderndiplomacy.eu/rss',
    'https://feeds.geopoliticalmonitor.com/rss',
    'https://feeds.globalresearch.ca/rss',
    'https://feeds.southfront.org/rss',
    'https://feeds.liveuamap.com/rss',
    'https://feeds.syria.liveuamap.com/rss',
    'https://feeds.africa.liveuamap.com/rss',
  ]
};

// Translation mapping for language codes
export const LANGUAGE_CODES = {
  russian: 'ru',
  chinese: 'zh',
  arabic: 'ar',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  japanese: 'ja',
  south_asia: 'en', // Most South Asian sources are in English
  oceania: 'en',
  nordic: 'en', // Will need individual language detection
};

// Get all sources as a flat array with metadata
export function getAllSources() {
  const allSources = [];
  
  Object.entries(GLOBAL_NEWS_SOURCES).forEach(([category, sources]) => {
    sources.forEach(url => {
      allSources.push({
        url,
        category,
        language: LANGUAGE_CODES[category] || 'en',
        needsTranslation: !!LANGUAGE_CODES[category]
      });
    });
  });
  
  return allSources;
}

// Get sources by language
export function getSourcesByLanguage(language) {
  return getAllSources().filter(source => source.language === language);
}

// Get sources by category
export function getSourcesByCategory(category) {
  return GLOBAL_NEWS_SOURCES[category] || [];
}

// Get high-priority sources for immediate processing
export function getHighPrioritySources() {
  return [
    ...GLOBAL_NEWS_SOURCES.international,
    ...GLOBAL_NEWS_SOURCES.defense_intelligence,
    ...GLOBAL_NEWS_SOURCES.conflict_monitoring,
    ...GLOBAL_NEWS_SOURCES.middle_east,
    ...GLOBAL_NEWS_SOURCES.eastern_europe
  ].map(url => ({
    url,
    priority: 'high',
    language: 'en',
    needsTranslation: false
  }));
}