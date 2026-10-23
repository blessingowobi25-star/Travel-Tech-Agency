import type { UpsertDestinationInput } from '@/repositories/destinations';

/**
 * Curated Nigerian destinations for the MVP.
 *
 * Budget figures are per person for a mid-range trip, in NGN, and are
 * deliberately conservative round numbers so they read as estimates rather
 * than quotes. They are a starting point that the AI layer adjusts against the
 * traveller's stated budget.
 *
 * `dataConfidence` and `reviewStatus` are set honestly: nothing here has been
 * verified against a live pricing source, so the rows stay `unverified` /
 * `draft` even though they are published for the demo.
 */

const SOURCES = ['internal-editorial-review'];

export const seedDestinations: UpsertDestinationInput[] = [
  {
    slug: 'lagos-lagos',
    name: 'Lagos',
    country: 'Nigeria',
    region: 'South West',
    destinationType: 'city',
    summary:
      'Nigeria\'s commercial engine: beaches, art galleries, live music and a food scene that runs from roadside stalls to rooftop restaurants.',
    description:
      'Lagos rewards travellers who move between its several faces. A morning can start with akara and agege sari at a roadside stand and end at a gallery opening in Lekki or a highlife set in Victoria Island. The traffic is the main tax on your day, so plan around it: cluster activities by neighbourhood and travel outside the 7am-9am and 4pm-7pm peaks. Tarkwa Bay, Nike Lake and the Lagos lagoon make good half-day escapes from the heat.',
    moods: ['energetic', 'social', 'creative', 'nightlife'],
    interests: ['food', 'beaches', 'arts', 'nightlife', 'shopping', 'history'],
    climateTags: ['tropical', 'hot', 'humid', 'rainy-season'],
    durationMinDays: 2,
    durationMaxDays: 5,
    costCategory: 'moderate',
    budgetMin: 45000,
    budgetMax: 120000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 35000,
      food: 15000,
      transport: 8000,
      activities: 7000,
    },
    logistics: {
      airport: 'Murtala Muhammed International (LOS), 15-40 min from the island depending on traffic',
      gettingAround: 'Bolt and Uber are cheapest; Danfo buses and BRT work for fixed routes',
      bestTimeToVisit: 'November to March for the dry season',
      tipping: '10% in restaurants, N200-500 for porters',
    },
    seasonality:
      'Rainy season runs roughly May to October with heavy, short afternoon downpours. Harmattan haze arrives December to February.',
    accessibilityNotes:
      'Main roads and major attractions are step-free, but kerbs and unpaved side streets are common. Use a car with higher clearance for the outer beaches.',
    familySuitability:
      'Good for families. Tarkwa Bay, the Lagos Zoo and the Nike Art Gallery work well with children; avoid Victoria Island traffic at peak hours.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Most West African visitors may enter visa-free; confirm with the Nigerian Immigration Service for your nationality',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'abuja-fct',
    name: 'Abuja',
    country: 'Nigeria',
    region: 'North Central',
    destinationType: 'city',
    summary:
      'The capital, built around Aso Rock and the Abuja National Mosque, with wide green verges, a lively arts district and easy access to rolling savannah hills.',
    description:
      'Abuja is the easiest Nigerian city to travel in: it was planned for cars, so distances are short and the roads are wide. Three Arms Zone and Wuse II carry most of the nightlife, while the Millennium Park, Millennium Tower and the National Mosque give the city its distinct skyline. The Zuma and Aso Rock viewpoints are short, easy day trips, and the nearby Ajaokuta and Kainji Lake areas open up longer-stay itineraries.',
    moods: ['relaxed', 'family-friendly', 'cultural', 'peaceful'],
    interests: ['architecture', 'nature', 'food', 'family', 'culture'],
    climateTags: ['tropical', 'warm', 'highland', 'harmattan'],
    durationMinDays: 2,
    durationMaxDays: 4,
    costCategory: 'moderate',
    budgetMin: 40000,
    budgetMax: 110000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 30000,
      food: 14000,
      transport: 10000,
      activities: 6000,
    },
    logistics: {
      airport: 'Nnamdi Azikiwe International (ABV), about 45 minutes from the city centre',
      gettingAround: 'Bolt and Uber are reliable; private hire for day trips to the hills',
      bestTimeToVisit: 'December to March, when the harmattan keeps the heat manageable',
      tipping: '10% in restaurants; guide fees are common at rock and attraction sites',
    },
    seasonality:
      'The hottest months are March to May. Harmattan between December and February brings dry, hazy mornings and large day-night temperature swings.',
    accessibilityNotes:
      'Roads are generally flat and wide with good paving. Attraction sites such as Zuma Rock involve uneven ground and climbing.',
    familySuitability:
      'Very family-friendly. The National Mosque, Millennium Park and the cableway to Zuma Rock are easy family outings.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'obudu-cattle-ranch',
    name: 'Obudu Mountain Resort',
    country: 'Nigeria',
    region: 'South East',
    destinationType: 'mountain',
    summary:
      'Hilltop resort in Cross River State above the Obudu escarpment, famous for its annual Calabar Carnival and the cool, forested plateau.',
    description:
      'Obudu sits in the mountains above the town of Obudu, and the elevation makes it the coolest place to escape to in southern Nigeria. The resort proper is dated, but the escarpment road, the canopy walkway and the surrounding forest are genuinely worth the trip. Visit in late August for the Calabar Carnival, when the region\'s cultural groups gather for music, dance and processions.',
    moods: ['romantic', 'peaceful', 'adventurous', 'nature'],
    interests: ['nature', 'mountains', 'culture', 'festivals', 'hiking'],
    climateTags: ['highland', 'cool', 'humid', 'rainy-season'],
    durationMinDays: 2,
    durationMaxDays: 4,
    costCategory: 'moderate',
    budgetMin: 35000,
    budgetMax: 90000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 22000,
      food: 12000,
      transport: 9000,
      activities: 5000,
    },
    logistics: {
      airport: 'Calabar International (CQB) then roughly 90 minutes by road to Obudu',
      gettingAround: 'Hire a car with a driver for the road up; the route is winding',
      bestTimeToVisit: 'Late August for the carnival; otherwise December to April',
      tipping: 'Agree the driver fee upfront; N1000-2000 at local sites',
    },
    seasonality:
      'Temperatures drop noticeably with altitude. Peak rainfall is June to September and the road can be slippery.',
    accessibilityNotes:
      'The plateau is reached by a winding road with steep sections. Main hotel facilities are accessible; the forest trails are not.',
    familySuitability:
      'Good for families in the dry season. The carnival is intense and loud, so younger children may find it overwhelming.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'calabar-cross-river',
    name: 'Calabar',
    country: 'Nigeria',
    region: 'South East',
    destinationType: 'city',
    summary:
      'The capital of Cross River State on the Calabar River, gateway to the rainforest, the Ibom Falls and the Calabar Carnival.',
    description:
      'Calabar is the easiest base for exploring the wider Cross River area. The Calabar River and the Marina Resort waterfront are pleasant, and the museum houses the Ekpo culture collection, which is worth an hour on its own. Ibom Falls is a short drive inland, and the rainforest around the state is some of the most intact in West Africa. Book accommodation early if you are visiting for the carnival in August.',
    moods: ['cultural', 'relaxed', 'curious', 'social'],
    interests: ['culture', 'nature', 'food', 'waterfalls', 'festivals'],
    climateTags: ['tropical', 'hot', 'humid', 'coastal'],
    durationMinDays: 2,
    durationMaxDays: 4,
    costCategory: 'budget',
    budgetMin: 30000,
    budgetMax: 80000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 18000,
      food: 11000,
      transport: 8000,
      activities: 5000,
    },
    logistics: {
      airport: 'Calabar International (CQB), 10-20 minutes from the city centre',
      gettingAround: 'Bolt and Uber in the city; hired car for Ibom Falls and the rainforest',
      bestTimeToVisit: 'December to March, or late August for the carnival',
      tipping: '10% in restaurants; small tips for guides and drivers',
    },
    seasonality:
      'Hot and humid with heavy rain between May and September. The carnival in late August brings huge visitor numbers and higher prices.',
    accessibilityNotes:
      'The city centre and waterfront are mostly flat. Ibom Falls has uneven, wet rock surfaces near the water.',
    familySuitability:
      'Suitable for families. The museum and waterfront are easy outings; the rainforest needs sturdy shoes for everyone.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'bonny-island-edo',
    name: 'Bonny Island',
    country: 'Nigeria',
    region: 'South South',
    destinationType: 'island',
    summary:
      'A lush Atlantic island in Rivers State, reachable only by boat, with the historical slave trade site at Bori Point and wide, quiet beaches.',
    description:
      'Bonny Island is Nigeria at its most removed from the mainland, and the journey by boat is part of the experience. The island holds the remains of the old European trading factories, a sobering and important visit, alongside beaches and the live music culture for which Bonny is known. Because everything is imported, prices run higher than on the mainland and bookings should be made well ahead.',
    moods: ['reflective', 'peaceful', 'remote', 'romantic'],
    interests: ['history', 'beaches', 'culture', 'island'],
    climateTags: ['tropical', 'hot', 'humid', 'coastal'],
    durationMinDays: 2,
    durationMaxDays: 5,
    costCategory: 'moderate',
    budgetMin: 45000,
    budgetMax: 130000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 35000,
      food: 16000,
      transport: 15000,
      activities: 6000,
    },
    logistics: {
      airport: 'Port Harcourt International (PHC), then roughly 90 minutes by road and boat',
      gettingAround: 'Walking, bicycles and hired cars on the island; boats for transfers',
      bestTimeToVisit: 'December to April',
      tipping: 'N500-1000 for boat crew and guides',
    },
    seasonality:
      'The Atlantic is roughest between June and September, when boat transfers can be cancelled at short notice.',
    accessibilityNotes:
      'Uneven sandy roads and steps at the historic site. Boat transfers are not wheelchair accessible.',
    familySuitability:
      'Fine for older children. The boat journey can be rough in high season, and the historical site is heavy subject matter for younger children.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'bauchi-josh',
    name: 'Jos and the Plateau',
    country: 'Nigeria',
    region: 'North Central',
    destinationType: 'highland',
    summary:
      'Cool highland country around Jos, with the Jos Museum, the Kainji Lake area and the Shere Hills wildlife park an easy drive from the city.',
    description:
      'Jos sits at roughly 1,200 metres and is the closest thing Nigeria has to a temperate highland break. The Jos Museum is one of the best small museums in West Africa, and the Shere Hills park is only a short drive out of town. The wider plateau leads towards Kainji Lake, where boat safaris and bush walks are the main draw.',
    moods: ['peaceful', 'adventurous', 'cool', 'nature'],
    interests: ['nature', 'wildlife', 'history', 'mountains', 'camping'],
    climateTags: ['highland', 'cool', 'harmattan'],
    durationMinDays: 2,
    durationMaxDays: 4,
    costCategory: 'budget',
    budgetMin: 28000,
    budgetMax: 75000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 15000,
      food: 10000,
      transport: 9000,
      activities: 5000,
    },
    logistics: {
      airport: 'Jos Airport (JOS), about 25 minutes from the city centre',
      gettingAround: 'Hired car or motorcycle taxi; the roads to Shere Hills are good',
      bestTimeToVisit: 'November to March',
      tipping: 'Small tips at guide sites; agree rates in advance',
    },
    seasonality:
      'Cool and dry from November to February, with nights near 10C. The plateau is the coolest option in Nigeria in that window.',
    accessibilityNotes:
      'Jos city is relatively flat. Shere Hills and Kainji Lake involve uneven ground that is not suited to wheelchairs.',
    familySuitability:
      'Good for families. The museum, the zoo and Shere Hills wildlife park are all child-friendly.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'ibeju-lekki-lagoon',
    name: 'Lekki Lagoon and Ibeju-Lekki',
    country: 'Nigeria',
    region: 'South West',
    destinationType: 'beach',
    summary:
      'A long stretch of Atlantic coastline near Lagos with Lekki Lagoon and the Slave History Museum on the Marina waterfront nearby.',
    description:
      'South-east of Lagos, the Lekki peninsula has some of the cleanest, least developed beach in the state. Lekki Lagoon gives you a completely different landscape from the ocean side, with birdlife and fishing communities along its edge. The Slave History Museum, built on stilts over the water, is a short trip away and worth dedicating time to.',
    moods: ['relaxed', 'beach', 'quiet', 'reflective'],
    interests: ['beaches', 'birdwatching', 'history', 'road-trips'],
    climateTags: ['tropical', 'hot', 'coastal', 'humid'],
    durationMinDays: 1,
    durationMaxDays: 3,
    costCategory: 'budget',
    budgetMin: 22000,
    budgetMax: 65000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 14000,
      food: 9000,
      transport: 8000,
      activities: 4000,
    },
    logistics: {
      airport: 'Murtala Muhammed International (LOS), 60-90 minutes by road',
      gettingAround: 'A car is needed for the peninsula; there is no reliable public transport',
      bestTimeToVisit: 'December to April',
      tipping: 'N500-1000 for boat and guide services',
    },
    seasonality:
      'Best from December to April. The Atlantic is rough between June and September.',
    accessibilityNotes:
      'Beach sand is soft and hard to navigate with wheeled mobility aids. The stilted museum has stair access only.',
    familySuitability:
      'Good for families, especially as a day trip or short overnight from Lagos.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'sokoto-kebbi',
    name: 'Sokoto and Kebbi',
    country: 'Nigeria',
    region: 'North West',
    destinationType: 'culture',
    summary:
      'The far north-west, home to the Gobirau Minaret, the Sultans\' palaces and the Hausa-Fulani traditions of the region.',
    description:
      'Sokoto sits at the centre of an old sultanate and rewards travellers who come for the culture rather than the attractions. The Gobirau Minaret is a striking piece of mud architecture, and the Sultan\'s Palace is open to respectful visitors. Further out, Kebbi and the Kainji Lake shore offer riverine and Sahelian landscapes that feel a long way from Lagos.',
    moods: ['curious', 'cultural', 'reflective', 'quiet'],
    interests: ['culture', 'architecture', 'history', 'desert', 'photography'],
    climateTags: ['hot', 'sahelian', 'dry', 'harmattan'],
    durationMinDays: 2,
    durationMaxDays: 4,
    costCategory: 'budget',
    budgetMin: 25000,
    budgetMax: 70000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 13000,
      food: 9000,
      transport: 9000,
      activities: 4000,
    },
    logistics: {
      airport: 'Sokoto International (SKO) with limited flights; otherwise via Kaduna',
      gettingAround: 'Hired car and driver strongly recommended for the road from Kaduna',
      bestTimeToVisit: 'November to March',
      tipping: 'Small tips at cultural sites; ask before photographing people',
    },
    seasonality:
      'Extremely hot from March to May. The harmattan from December to February brings dry, dusty conditions that can reduce visibility on the road.',
    accessibilityNotes:
      'Rough, sandy roads and mostly uneven ground around the heritage sites. Not a good fit for limited mobility.',
    familySuitability:
      'Suitable for older children who are interested in history. Long drives and heat are hard on very young children.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points. Some northern states apply additional internal checks.',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'enugu-nsukka',
    name: 'Enugu and Nsukka',
    country: 'Nigeria',
    region: 'South East',
    destinationType: 'city',
    summary:
      'The Coal City, with the Awhum Cave and the rolling countryside around Nsukka, plus the warm, easy rhythm of the region.',
    description:
      'Enugu is compact, walkable in the centre and full of history, from the 1914 Ngwa statue at the roundabout to the National Museum. Awhum Cave outside the city draws pilgrims in its own right and is an easy half-day trip. Nsukka, an hour away, has a genuinely small-town feel and is where a lot of the region\'s road trips naturally end.',
    moods: ['relaxed', 'social', 'cultural', 'easygoing'],
    interests: ['food', 'history', 'music', 'road-trips'],
    climateTags: ['tropical', 'warm', 'humid'],
    durationMinDays: 2,
    durationMaxDays: 3,
    costCategory: 'budget',
    budgetMin: 25000,
    budgetMax: 70000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 14000,
      food: 10000,
      transport: 6000,
      activities: 4000,
    },
    logistics: {
      airport: 'Enugu International (ENU), about 10 minutes from the city centre',
      gettingAround: 'Bolt and Uber within the city; a hired car for Awhum Cave and Nsukka',
      bestTimeToVisit: 'December to April',
      tipping: '10% in restaurants; small tips at guides',
    },
    seasonality:
      'Warm all year with heavy rain between April and September. The Enugu and Nsukka roads are busy on public holidays.',
    accessibilityNotes:
      'The city centre is fairly flat. Awhum Cave involves stairs, uneven ground and low light.',
    familySuitability:
      'Very family-friendly, with the museum, Awhum Cave and the local food as the main draws.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'benin-city-edo',
    name: 'Benin City',
    country: 'Nigeria',
    region: 'South South',
    destinationType: 'city',
    summary:
      'Home of the Oba of Benin and the celebrated Benin bronzes, with the Oba\'s Palace, Igun Street and the ruins of the old wall.',
    description:
      'Benin City is the most historically dense place in Nigeria after Ife, and the bronzes and ivories cast here in the fifteenth and sixteenth centuries now sit in museums in Europe. The Oba\'s Palace and the Igun Street craft quarter, where the engravers still work in bronze, are the centre of it. The ruins of the ancient walls and the Oba\'s Museum are open and worth the time.',
    moods: ['curious', 'cultural', 'proud', 'immersive'],
    interests: ['history', 'arts', 'crafts', 'culture', 'food'],
    climateTags: ['tropical', 'hot', 'humid'],
    durationMinDays: 1,
    durationMaxDays: 3,
    costCategory: 'budget',
    budgetMin: 24000,
    budgetMax: 65000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 12000,
      food: 9000,
      transport: 7000,
      activities: 4500,
    },
    logistics: {
      airport: 'Benin Airport (BNI), about 30 minutes from the palace',
      gettingAround: 'Bolt and Uber; taxis are cheap and widely used',
      bestTimeToVisit: 'December to April',
      tipping: 'Tip guides and craft demonstrators; 10% in restaurants',
    },
    seasonality:
      'Hot and humid, with the heaviest rain between May and July. The Igue festival falls around the new year and is worth timing a trip around.',
    accessibilityNotes:
      'Mostly flat, though the palace and museum areas have uneven paving. Igun Street is narrow with tight workshop spaces.',
    familySuitability:
      'Good for families. The Oba\'s Museum and the Igun Street workshops are engaging for older children.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'yola-adamawa',
    name: 'Yola and the Adamawa Highlands',
    country: 'Nigeria',
    region: 'North East',
    destinationType: 'highland',
    summary:
      'The foothills of the Cameroon mountains, with the Lamidat\'s palace and the Mandara mountains close by.',
    description:
      'Yola sits where the highlands begin, and the Mandara mountains rise dramatically just to the east. The Lamidat\'s Palace in Yola is a significant seat of a traditional ruler, and the relics of Lamido Aliu Abubakar draw visitors from across the country. The Michika and Gwoza highlands offer cool air, terraced farming and a very different landscape from the lowlands.',
    moods: ['peaceful', 'curious', 'scenic', 'cool'],
    interests: ['nature', 'history', 'mountains', 'culture'],
    climateTags: ['highland', 'cool', 'harmattan'],
    durationMinDays: 2,
    durationMaxDays: 3,
    costCategory: 'budget',
    budgetMin: 22000,
    budgetMax: 60000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 12000,
      food: 8000,
      transport: 8000,
      activities: 3500,
    },
    logistics: {
      airport: 'Yola International (YOL), about 20 minutes from the city centre',
      gettingAround: 'Hired car and driver; mountain roads are steep and winding',
      bestTimeToVisit: 'November to March',
      tipping: 'N500-1000 for guides; confirm palace access arrangements in advance',
    },
    seasonality:
      'Cool and pleasant from November to February. Heavy rain from June to September can make the mountain roads difficult.',
    accessibilityNotes:
      'The city is flat, but the Mandara mountain roads are steep with uneven surfaces. Limited accessible facilities in the highlands.',
    familySuitability:
      'Suitable for families in the dry season. The palace and the museum in Yola are the easiest outings.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points. Travel advisories may apply for the far north-east.',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
  {
    slug: 'owerri-imo',
    name: 'Owerri and Imo',
    country: 'Nigeria',
    region: 'South East',
    destinationType: 'city',
    summary:
      'The eastern heartland: a green, hilly city of palm and farmland, with the Owerri zoo, the Nri museum and the Mbari workshop.',
    description:
      'Owerri is green in a way that most Nigerian cities are not, sitting in a basin of oil palm, raffia and food crops. The Nri museum and the Mbari workshop, both linked to the Igbo creation story, are the intellectual centrepiece. The zoo and the Owerri Millennium stadium anchor the more recent history, and the road up to Orzu through the hills is one of the more scenic drives in the south-east.',
    moods: ['relaxed', 'green', 'cultural', 'quiet'],
    interests: ['history', 'nature', 'food', 'crafts', 'road-trips'],
    climateTags: ['tropical', 'warm', 'humid', 'green'],
    durationMinDays: 1,
    durationMaxDays: 3,
    costCategory: 'budget',
    budgetMin: 20000,
    budgetMax: 60000,
    budgetCurrency: 'NGN',
    costComponents: {
      accommodation: 11000,
      food: 8000,
      transport: 6000,
      activities: 3500,
    },
    logistics: {
      airport: 'Sam Mbakwe International (QOW) in Owerri, with limited direct flights',
      gettingAround: 'Bolt and Uber in the city; a hired car for the Orzu hills',
      bestTimeToVisit: 'December to April',
      tipping: '10% in restaurants; small tips at the museum',
    },
    seasonality:
      'Rain falls hard from April to July, when the surrounding farmland is at its greenest. The dry season is dusty but reliable.',
    accessibilityNotes:
      'Generally flat and paved in the city centre. The Orzu road climbs with gradients and no hard shoulder.',
    familySuitability:
      'Very family-friendly. The zoo and the Nri museum are the main draws for children.',
    entryRequirements: {
      passport: 'Valid for at least six months',
      visa: 'Same rules as other Nigerian entry points',
    },
    sources: SOURCES,
    dataConfidence: 'unverified',
    reviewStatus: 'draft',
    isPublished: true,
  },
];

/**
 * The demo staff and customer accounts.
 *
 * The password is deliberately obvious. These accounts exist so a reviewer can
 * sign in immediately on a fresh clone, not for real use.
 */
export const seedUsers = [
  {
    email: 'admin@waymark.test',
    fullName: 'Waymark Admin',
    password: 'Waymark123!',
    role: 'admin' as const,
    phone: '+2348000000001',
  },
  {
    email: 'agent@waymark.test',
    fullName: 'Tolu Agent',
    password: 'Waymark123!',
    role: 'agent' as const,
    phone: '+2348000000002',
  },
  {
    email: 'customer@waymark.test',
    fullName: 'Amaka Customer',
    password: 'Waymark123!',
    role: 'customer' as const,
    phone: '+2348000000003',
  },
];
