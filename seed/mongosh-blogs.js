// Paste this whole file into mongosh (or the Compass MONGOSH tab) while connected to YOUR database.
// First run:  use <your-database-name>
// Adds / updates 14 blog posts (matched by slug). Packages and bookings are not touched.
const blogs = [
  {
    "title": "A calm Schengen visa checklist for Bangladeshi travellers",
    "category": "Visa & Documents",
    "excerpt": "Paris, Rome, Barcelona or Prague: what to prepare before you apply, and the mistakes that cause delays.",
    "image": "",
    "tags": [
      "visa",
      "europe",
      "paris",
      "rome"
    ],
    "author": "Sababa Travel Desk",
    "featured": true,
    "published": true,
    "publishedAt": "2026-11-24T09:00:00.000Z",
    "slug": "a-calm-schengen-visa-checklist-for-bangladeshi-travellers",
    "body": [
      "A Schengen visa is the single permit that covers most of continental Europe, so one application can take you from Paris to Rome to Prague. The embassy of the country where you will spend the most nights is normally the one you apply through. If your nights are equal, you apply to the country you enter first.",
      "Most applications ask for the same core set: a passport with enough validity and blank pages, recent photographs, a filled form, travel insurance that covers Schengen medical costs, a hotel plan for every night, a flight plan, and bank statements and income papers that show you can fund the trip. Clear, consistent papers matter more than a heavy file.",
      "The most common delays come from dates that do not match across documents, statements that look newly topped up, and booking proofs that are missing nights. Apply early, keep every document in one folder, and never rely on a single last-minute appointment slot.",
      "Visa rules, fees and appointment systems change often. Treat this as a planning guide, check the embassy or visa centre page of your destination before you apply, and ask our desk if you want a second pair of eyes on your file. Our Europe packages include visa support."
    ],
    "readMinutes": 1
  },
  {
    "title": "Best time to visit Paris, Rome and Barcelona",
    "category": "Destination Guide",
    "excerpt": "A month-by-month feel for Europe's big three city breaks, from tulip-bright spring to quiet winter streets.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg/1280px-La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "paris",
      "rome",
      "barcelona",
      "season"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-18T09:00:00.000Z",
    "slug": "best-time-to-visit-paris-rome-and-barcelona",
    "body": [
      "Spring (April to early June) and early autumn (September to October) are the sweet spot for most of Europe: long light, mild days and fewer queues than peak summer. Gardens are in bloom in spring, and the autumn light is soft for photographs.",
      "July and August bring the longest days but also the biggest crowds and the highest prices, and Rome and Barcelona can be properly hot. If summer is your only window, plan indoor sights for midday and keep mornings and evenings for the outdoors.",
      "Winter is quieter and cheaper, with Christmas markets in December and short, cold days. It suits travellers who care more about museums, food and a slower pace than long evenings by the river.",
      "Whichever month you choose, book big sights such as the Eiffel Tower, the Colosseum and Sagrada Familia ahead. Our desk times entries for the least crowded slot we can find."
    ],
    "readMinutes": 1
  },
  {
    "title": "Umrah from Bangladesh: planning a peaceful journey",
    "category": "Pilgrimage",
    "excerpt": "Practical preparation for first-time pilgrims: paperwork, stay, pace, and travelling with parents.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/The_Ka%27ba%2C_Great_Mosque_of_Mecca%2C_Saudi_Arabia_%284%29.jpg/1280px-The_Ka%27ba%2C_Great_Mosque_of_Mecca%2C_Saudi_Arabia_%284%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "umrah",
      "makkah",
      "madinah",
      "pilgrimage"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-16T09:00:00.000Z",
    "slug": "umrah-from-bangladesh-planning-a-peaceful-journey",
    "body": [
      "Umrah is a journey of the heart first, and a well-planned trip lets you give your attention to worship rather than logistics. Start with the paperwork: a valid passport, the required vaccinations, and visa processing through an authorised channel.",
      "Choose a stay by walking distance to the Haram in Makkah and the Prophet's Mosque in Madinah rather than by star rating alone. For elderly parents, a short walk and easy lift access matter more than any amenity.",
      "Pace yourself. Rest between rituals, drink water often, and travel with comfortable footwear and light clothing. Keep a small bag with your documents, medicines and a phone number for your group leader at all times.",
      "Rules and seasonal limits for pilgrims change, so always confirm the current requirements before you pay for anything. Our Umrah package is arranged with licensed partners and a guide who knows the routine."
    ],
    "readMinutes": 1
  },
  {
    "title": "Dubai for first-timers: a 4-day plan that works",
    "category": "Planning",
    "excerpt": "How to fit the Burj Khalifa, the desert and the old creek into a short stay without rushing.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg/1280px-Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "dubai",
      "uae",
      "city break"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-14T09:00:00.000Z",
    "slug": "dubai-for-first-timers-a-4-day-plan-that-works",
    "body": [
      "Dubai rewards a short trip if you group sights by area. Spend one day on Downtown, with the Burj Khalifa observation deck, the fountain show and the mall. Keep another for the old city, with the creek, the souks and an abra ride across the water.",
      "A desert evening is the classic highlight: dune driving, a camp dinner and a clear sky. Choose a well-reviewed operator and go in the cooler months if you can, because midday heat from May to September is intense.",
      "Dress modestly outside beaches and resorts, carry a light layer for the strong air conditioning indoors, and use the metro for easy, cheap trips between areas.",
      "Fly in with at least one buffer day if you are connecting onward, and let our desk confirm the current visa rules for your passport before you book."
    ],
    "readMinutes": 1
  },
  {
    "title": "Maldives on a smarter budget",
    "category": "Budget",
    "excerpt": "The Maldives does not have to mean one extravagant resort. Here is how to stretch the trip.",
    "image": "",
    "tags": [
      "maldives",
      "budget",
      "beach",
      "island"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-12T09:00:00.000Z",
    "slug": "maldives-on-a-smarter-budget",
    "body": [
      "The cost of the Maldives is mostly the resort and the seaplane. Guesthouses on local islands offer the same turquoise water and snorkelling at a fraction of the price, and many have house reefs a few steps from the beach.",
      "Travel in the shoulder months, such as late April or November, when rates drop and the weather is still pleasant. Book flights and transfers together so the schedule between the airport and the island lines up.",
      "Ask what is included. Half board, a boat trip, snorkelling gear and a sandbank picnic can turn a plain room into a full holiday and avoid surprise charges.",
      "Remember that local islands have their own rules on dress and alcohol. Respect them and you will be welcomed warmly."
    ],
    "readMinutes": 1
  },
  {
    "title": "Japan from Bangladesh: Tokyo, Fuji and Kyoto in one trip",
    "category": "Destination Guide",
    "excerpt": "A simple route that links the skyline of Tokyo, the calm of Mount Fuji and the temples of Kyoto.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/View_of_Mount_Fuji_from_%C5%8Cwakudani_20211202.jpg/1280px-View_of_Mount_Fuji_from_%C5%8Cwakudani_20211202.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "japan",
      "tokyo",
      "kyoto",
      "fuji"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-10T09:00:00.000Z",
    "slug": "japan-from-bangladesh-tokyo-fuji-and-kyoto-in-one-trip",
    "body": [
      "Japan is easier to plan than it looks because the trains are punctual and the signs are bilingual. A classic route starts in Tokyo, makes a day trip to the Mount Fuji area, then continues by bullet train to Kyoto.",
      "Spring cherry blossom and autumn leaves are the most famous seasons, and also the busiest. If you want fewer crowds, consider early June or late November and book hotels early.",
      "Carry some cash, because small shops and shrines often do not take cards, and learn a few polite phrases. People appreciate the effort even when the words are clumsy.",
      "A visa is required for Bangladeshi passport holders. Check the current process with the embassy or ask our desk for help preparing the file."
    ],
    "readMinutes": 1
  },
  {
    "title": "Bali beyond the beach: temples, rice terraces and calm mornings",
    "category": "Destination Guide",
    "excerpt": "Where to find the quiet side of the island, and how to arrange your days around the heat and the crowds.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/TanahLot_2014.JPG/1280px-TanahLot_2014.JPG?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "bali",
      "indonesia",
      "temples"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-08T09:00:00.000Z",
    "slug": "bali-beyond-the-beach-temples-rice-terraces-and-calm-mornings",
    "body": [
      "Bali is far more than beach clubs. Inland Ubud offers rice terraces, art markets and morning yoga, while the coast has cliff temples like Tanah Lot that glow at sunset.",
      "Start early. Mornings are cooler and the famous spots are quieter, and by afternoon you can rest at the hotel or by the pool. A private driver for the day is affordable and removes the stress of traffic.",
      "Dress respectfully at temples, with a sarong and covered shoulders, and never step on the small offerings you will see on the ground. These small courtesies are noticed and appreciated.",
      "The dry season from April to October is the most reliable for sightseeing."
    ],
    "readMinutes": 1
  },
  {
    "title": "Everest Base Camp: how to prepare your body and your kit",
    "category": "Adventure",
    "excerpt": "Training, acclimatisation and packing advice for one of the world's most famous treks.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Mt._Everest_from_Gokyo_Ri_November_5%2C_2012.jpg/1280px-Mt._Everest_from_Gokyo_Ri_November_5%2C_2012.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "nepal",
      "everest",
      "trek"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-06T09:00:00.000Z",
    "slug": "everest-base-camp-how-to-prepare-your-body-and-your-kit",
    "body": [
      "The Everest Base Camp trek is a long walk at altitude rather than a technical climb, but it is demanding. Start training at least two months ahead with hill walking, stair climbing and long days on your feet with a loaded pack.",
      "Acclimatisation is the key to a safe trek. Ascend slowly, follow the rest days built into the itinerary, drink plenty of water and tell your guide at once if you feel unwell. Headaches, nausea and unusual tiredness should never be ignored.",
      "Pack in layers: a warm down jacket, a waterproof shell, broken-in boots, a good sleeping bag and sun protection. Everything you carry should earn its weight.",
      "Spring and autumn offer the clearest skies. Travel insurance that covers high-altitude trekking and evacuation is essential."
    ],
    "readMinutes": 1
  },
  {
    "title": "Safari basics: making the most of the Serengeti",
    "category": "Adventure",
    "excerpt": "What to expect on a wildlife safari, when to go and how to behave around animals.",
    "image": "",
    "tags": [
      "tanzania",
      "safari",
      "wildlife"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-04T09:00:00.000Z",
    "slug": "safari-basics-making-the-most-of-the-serengeti",
    "body": [
      "A safari is about patience as much as sightings. Early mornings and late afternoons are when animals are most active, and your guide reads small signs that a visitor would miss.",
      "The dry season from late June to October is generally the best for spotting wildlife around water, and the great migration moves through the region at different times, so ask which part of the park suits your dates.",
      "Pack neutral clothing, a hat, binoculars and a camera with a long lens if you have one. Keep your voice low, stay inside the vehicle unless your guide says otherwise, and never feed or approach animals.",
      "Book with an operator that supports park fees and local communities. It is better for wildlife and for the people who live beside it."
    ],
    "readMinutes": 1
  },
  {
    "title": "Packing once for a multi-country trip",
    "category": "Travel Tips",
    "excerpt": "A short list that works whether you are crossing Europe, Southeast Asia or the Middle East.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Rucksack1.jpg/1280px-Rucksack1.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "packing",
      "tips",
      "luggage"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-11-02T09:00:00.000Z",
    "slug": "packing-once-for-a-multi-country-trip",
    "body": [
      "Pack for a week, not for the whole trip. Most hotels and guesthouses have laundry, and a smaller bag is easier on trains, buses and stairs.",
      "Bring a small universal adapter, a power bank, a copy of your passport and booking details, and any medicines in their original packaging. Keep your documents and valuables in your hand baggage, never in a checked bag.",
      "Choose clothes that layer and dry quickly, and a pair of comfortable shoes that you have already worn in. A light scarf or shawl is useful for religious sites everywhere.",
      "Leave some space for souvenirs. You will almost certainly bring something home."
    ],
    "readMinutes": 1
  },
  {
    "title": "Travel insurance: what to check before you fly",
    "category": "Travel Tips",
    "excerpt": "Medical cover, cancellations and baggage: the few lines worth reading in your policy.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Overseas_travel_insurance_Vending_machines_in_the_Japanese_Airport.jpg/1280px-Overseas_travel_insurance_Vending_machines_in_the_Japanese_Airport.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "insurance",
      "safety",
      "tips"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-10-30T09:00:00.000Z",
    "slug": "travel-insurance-what-to-check-before-you-fly",
    "body": [
      "Travel insurance is the cheapest safety net in your budget. The most important line is medical cover, including emergency treatment and, for some destinations, return to your home country if needed.",
      "Check the cancellation terms, because they decide whether you get money back if you fall ill or a family emergency forces a change. Also look at baggage and delay cover, and whether your activities, such as trekking or diving, are included.",
      "Some countries and visa types require proof of insurance, so keep a digital and a printed copy with the policy number and the emergency phone line.",
      "Read the exclusions once. A policy you understand is worth far more than one you simply bought."
    ],
    "readMinutes": 1
  },
  {
    "title": "Cappadocia and Santorini: two sunrises and sunsets worth planning for",
    "category": "Destination Guide",
    "excerpt": "Hot-air balloons at dawn and caldera views at dusk, and how to avoid disappointment.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Cappadocia_balloon_trip%2C_Ortahisar_Castle_%2811893715185%29.jpg/1280px-Cappadocia_balloon_trip%2C_Ortahisar_Castle_%2811893715185%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "turkey",
      "greece",
      "sunrise",
      "sunset"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-10-28T09:00:00.000Z",
    "slug": "cappadocia-and-santorini-two-sunrises-and-sunsets-worth-planning-for",
    "body": [
      "Both places are about light. In Cappadocia, balloons rise at sunrise over the valleys. In Santorini, the sunset over the caldera draws crowds to Oia every evening.",
      "Balloon flights depend on the weather and can be cancelled at short notice, so give yourself more than one morning. In Santorini, arrive at a viewpoint an hour early, or choose a quieter village with a similar view.",
      "Dress warmly for early mornings in Cappadocia, even in summer, and wear shoes with grip for the stone steps in both places.",
      "Late spring and early autumn give the best balance of weather, prices and crowds."
    ],
    "readMinutes": 1
  },
  {
    "title": "Best time to visit Bangladesh's hill destinations",
    "category": "Travel Tips",
    "excerpt": "A practical seasonal guide for dry trails, clear views, waterfalls and comfortable road transfers.",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Bandarban_City_02.jpg/1280px-Bandarban_City_02.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail",
    "tags": [
      "bangladesh",
      "bandarban",
      "hills"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-10-15T09:00:00.000Z",
    "slug": "best-time-to-visit-bangladesh-s-hill-destinations",
    "body": [
      "The cooler, drier months from October to March give the clearest views and the most comfortable trails, which is why most hill itineraries are planned then.",
      "The rainy months bring fuller waterfalls but slippery paths and occasional road delays, so plans need more buffer time and a guide who knows the ground.",
      "Whatever the month, start early, carry water, and let the travel desk know your fitness level so the route can be matched to you."
    ],
    "readMinutes": 1
  },
  {
    "title": "Responsible travel in local communities",
    "category": "Culture",
    "excerpt": "How to travel with curiosity and respect while supporting local guides, hosts and makers.",
    "image": "https://upload.wikimedia.org/wikipedia/commons/a/ad/The_renowned_Kakum_National_Reserve.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled",
    "tags": [
      "culture",
      "responsible",
      "community"
    ],
    "author": "Sababa Travel Desk",
    "featured": false,
    "published": true,
    "publishedAt": "2026-08-20T09:00:00.000Z",
    "slug": "responsible-travel-in-local-communities",
    "body": [
      "Ask before photographing people or homes, and dress modestly when visiting villages and places of worship.",
      "Buy directly from local makers and eat where locals eat. It keeps more of your spend in the community you are visiting.",
      "Carry out what you carry in. Plastic bottles and wrappers do not belong on trails, lakes or beaches."
    ],
    "readMinutes": 1
  }
];

blogs.forEach((b) => {
  const { publishedAt, ...rest } = b;
  db.blogs.updateOne(
    { slug: b.slug },
    { $set: { ...rest, publishedAt: new Date(publishedAt), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
});
db.blogs.createIndex({ slug: 1 }, { unique: true });
print("blogs: " + db.blogs.countDocuments());
