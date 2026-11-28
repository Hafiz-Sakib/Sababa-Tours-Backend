// NOTE: run  node seed/resolve-images.js  once first, so every package has a real photo URL in this file.
// Paste this whole file into mongosh (or Compass > MONGOSH tab) while connected to YOUR database.
// First run:  use <your-database-name>   (see the guide for how to find it)
// It deletes ALL bookings and ALL packages, then inserts the 50 new packages.
const packages = [
  {
    "name": "Paris & the Eiffel Tower",
    "about": "Walk the Champ de Mars, go up the Eiffel Tower at sunset, cruise the Seine and visit the Louvre and Montmartre. Return flights from Dhaka, 3-star hotel, breakfast, Schengen visa support and guided city tours included.",
    "balance": "BDT 3,40,000",
    "picture": "",
    "category": "Landmark",
    "duration": "6 Days / 5 Nights",
    "location": "Paris, France"
  },
  {
    "name": "Rome & the Colosseum",
    "about": "Step inside the Colosseum and the Roman Forum with a skip-the-line guide, then see the Vatican, Trevi Fountain and Spanish Steps. Flights from Dhaka, hotel with breakfast, Schengen visa support and city transfers included.",
    "balance": "BDT 3,20,000",
    "picture": "",
    "category": "Heritage",
    "duration": "6 Days / 5 Nights",
    "location": "Rome, Italy"
  },
  {
    "name": "Taj Mahal & Golden Triangle",
    "about": "See the Taj Mahal at sunrise in Agra, then the Red Fort, Amber Fort in Jaipur and old Delhi. Flights from Dhaka, India visa help, hotels, breakfast and an AC car with driver included.",
    "balance": "BDT 48,000",
    "picture": "",
    "category": "Heritage",
    "duration": "4 Days / 3 Nights",
    "location": "Agra, India"
  },
  {
    "name": "Great Wall & Beijing",
    "about": "Climb the Great Wall at Mutianyu, visit the Forbidden City, Temple of Heaven and Tiananmen Square and try Peking duck. Flights from Dhaka, China visa support, 4-star hotel and a private guide included.",
    "balance": "BDT 1,40,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Beijing, China"
  },
  {
    "name": "Machu Picchu Inca Trail Journey",
    "about": "Travel from Lima to Cusco and the Sacred Valley, then take the train to Aguas Calientes and the Inca citadel of Machu Picchu. Flights, trains, hotels, entry tickets and local guides included.",
    "balance": "BDT 5,80,000",
    "picture": "",
    "category": "Heritage",
    "duration": "8 Days / 7 Nights",
    "location": "Cusco, Peru"
  },
  {
    "name": "Pyramids of Giza & Cairo",
    "about": "Stand before the Great Pyramid and the Sphinx, visit the Egyptian Museum and a Nile dinner cruise, and wander Khan el-Khalili bazaar. Flights from Dhaka, 4-star hotel, breakfast and guide included.",
    "balance": "BDT 1,60,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Cairo, Egypt"
  },
  {
    "name": "Dubai & Burj Khalifa",
    "about": "Go up Burj Khalifa, take a desert safari with dune driving, cruise Dubai Marina and shop at the Gold Souk and Dubai Mall. Flights from Dhaka, hotel, breakfast, UAE visa and transfers included.",
    "balance": "BDT 95,000",
    "picture": "",
    "category": "City",
    "duration": "5 Days / 4 Nights",
    "location": "Dubai, UAE"
  },
  {
    "name": "New York & Statue of Liberty",
    "about": "Ferry to the Statue of Liberty and Ellis Island, walk Central Park and Times Square, and see the Empire State Building at night. Flights from Dhaka, Manhattan hotel and city passes included. US visa is applied separately.",
    "balance": "BDT 4,80,000",
    "picture": "",
    "category": "Landmark",
    "duration": "6 Days / 5 Nights",
    "location": "New York, USA"
  },
  {
    "name": "Sydney & the Opera House",
    "about": "See the Sydney Opera House, climb the Harbour Bridge area, relax at Bondi Beach and take a ferry to Manly. Flights from Dhaka, hotel with breakfast and a harbour cruise included. Australian visa is applied separately.",
    "balance": "BDT 4,20,000",
    "picture": "",
    "category": "Landmark",
    "duration": "7 Days / 6 Nights",
    "location": "Sydney, Australia"
  },
  {
    "name": "Santorini Sunset Escape",
    "about": "White houses and blue domes of Oia and Fira, a caldera boat trip and a sunset dinner above the sea. Flights from Dhaka, cliffside hotel, breakfast, ferry and Schengen visa support included.",
    "balance": "BDT 3,60,000",
    "picture": "",
    "category": "Island",
    "duration": "6 Days / 5 Nights",
    "location": "Santorini, Greece"
  },
  {
    "name": "Maldives Island Resort Stay",
    "about": "Stay at a resort in the Baa Atoll with clear lagoons, a snorkel trip with reef fish and a sandbank picnic. Flights from Dhaka, speedboat or seaplane transfer, half board and snorkel gear included.",
    "balance": "BDT 1,35,000",
    "picture": "",
    "category": "Island",
    "duration": "4 Days / 3 Nights",
    "location": "Baa Atoll, Maldives"
  },
  {
    "name": "Petra & Wadi Rum",
    "about": "Walk the Siq to the Treasury at Petra, camp under the stars in Wadi Rum and float in the Dead Sea. Flights from Dhaka, hotels, desert camp, entry tickets and Jordan visa support included.",
    "balance": "BDT 2,10,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Petra, Jordan"
  },
  {
    "name": "Angkor Wat Temple Tour",
    "about": "See sunrise over Angkor Wat, the faces of Bayon and the tree-wrapped Ta Prohm, and enjoy Siem Reap night market. Flights from Dhaka, hotel, 3-day temple pass, tuk-tuk and guide included.",
    "balance": "BDT 85,000",
    "picture": "",
    "category": "Heritage",
    "duration": "4 Days / 3 Nights",
    "location": "Siem Reap, Cambodia"
  },
  {
    "name": "Mount Fuji & Tokyo",
    "about": "See Mount Fuji from Lake Kawaguchi, ride the Shinkansen and explore Shibuya, Asakusa and Akihabara in Tokyo. Flights from Dhaka, hotel, rail pass for transfers and Japan visa support included.",
    "balance": "BDT 2,70,000",
    "picture": "",
    "category": "Mountain",
    "duration": "6 Days / 5 Nights",
    "location": "Fuji, Japan"
  },
  {
    "name": "Bali & Tanah Lot Temple",
    "about": "Watch sunset at Tanah Lot sea temple, walk Tegallalang rice terraces, visit Ubud monkey forest and relax in Seminyak. Flights from Dhaka, resort stay, breakfast and a private driver included.",
    "balance": "BDT 1,10,000",
    "picture": "",
    "category": "Beach",
    "duration": "5 Days / 4 Nights",
    "location": "Bali, Indonesia"
  },
  {
    "name": "Grand Canyon & Las Vegas",
    "about": "See the sunset over the Grand Canyon South Rim, ride a helicopter over the canyon and enjoy Las Vegas strip lights. Flights, hotels, park entry and coach tour included. US visa is applied separately.",
    "balance": "BDT 4,50,000",
    "picture": "",
    "category": "Nature",
    "duration": "6 Days / 5 Nights",
    "location": "Arizona, USA"
  },
  {
    "name": "Niagara Falls & Toronto",
    "about": "Take the Hornblower boat to the foot of Niagara Falls, walk behind the falls and see the Toronto CN Tower. Flights from Dhaka, hotel, boat tickets and coach transfers included. Canada visa is applied separately.",
    "balance": "BDT 4,00,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Ontario, Canada"
  },
  {
    "name": "Venice Gondola & Canal City",
    "about": "Ride a gondola on the Grand Canal, see St Mark's Square, visit Murano glass island and Burano's coloured houses. Flights from Dhaka, hotel, breakfast, vaporetto pass and Schengen visa support included.",
    "balance": "BDT 3,00,000",
    "picture": "",
    "category": "City",
    "duration": "4 Days / 3 Nights",
    "location": "Venice, Italy"
  },
  {
    "name": "London & Big Ben",
    "about": "See Big Ben, Westminster Abbey, Tower Bridge, Buckingham Palace and a ride on the London Eye. Flights from Dhaka, central hotel, breakfast, Oyster travel card and UK visa support included.",
    "balance": "BDT 3,90,000",
    "picture": "",
    "category": "Landmark",
    "duration": "6 Days / 5 Nights",
    "location": "London, UK"
  },
  {
    "name": "Barcelona & Sagrada Familia",
    "about": "Visit Gaudi's Sagrada Familia and Park Guell, stroll Las Ramblas and the Gothic Quarter and relax on Barceloneta beach. Flights from Dhaka, hotel with breakfast, entry tickets and Schengen visa support included.",
    "balance": "BDT 3,10,000",
    "picture": "",
    "category": "Landmark",
    "duration": "5 Days / 4 Nights",
    "location": "Barcelona, Spain"
  },
  {
    "name": "Athens & the Acropolis",
    "about": "Climb to the Parthenon on the Acropolis, visit the Acropolis Museum and eat in the old Plaka streets. Flights from Dhaka, hotel with breakfast, entry tickets and Schengen visa support included.",
    "balance": "BDT 2,90,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Athens, Greece"
  },
  {
    "name": "Istanbul & Hagia Sophia",
    "about": "Visit Hagia Sophia, the Blue Mosque and Topkapi Palace, cruise the Bosphorus and shop at the Grand Bazaar. Flights from Dhaka, hotel with Turkish breakfast, guide and Turkey e-visa help included.",
    "balance": "BDT 1,45,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Istanbul, Turkey"
  },
  {
    "name": "Singapore & Marina Bay Sands",
    "about": "See the Gardens by the Bay light show, the Marina Bay Sands skyline, Sentosa island and Universal Studios. Flights from Dhaka, hotel, breakfast and attraction tickets included.",
    "balance": "BDT 1,05,000",
    "picture": "",
    "category": "City",
    "duration": "4 Days / 3 Nights",
    "location": "Singapore"
  },
  {
    "name": "Kuala Lumpur & Petronas Towers",
    "about": "Visit the Petronas Twin Towers Skybridge, Batu Caves, Genting Highlands cable car and KL street food. Flights from Dhaka, hotel, breakfast and airport and city transfers included.",
    "balance": "BDT 70,000",
    "picture": "",
    "category": "City",
    "duration": "4 Days / 3 Nights",
    "location": "Kuala Lumpur, Malaysia"
  },
  {
    "name": "Phi Phi Islands Island Hopping",
    "about": "Speedboat to Maya Bay, Pileh Lagoon and Monkey Beach, snorkel clear water and stay on Krabi or Phuket. Flights from Dhaka, beach hotel, breakfast and island tour with lunch included.",
    "balance": "BDT 78,000",
    "picture": "",
    "category": "Island",
    "duration": "5 Days / 4 Nights",
    "location": "Phi Phi, Thailand"
  },
  {
    "name": "Bangkok & the Grand Palace",
    "about": "See the Grand Palace, Wat Pho's reclining Buddha and Wat Arun, cruise the Chao Phraya River and visit a floating market. Flights from Dhaka, hotel, breakfast, guide and transfers included.",
    "balance": "BDT 62,000",
    "picture": "",
    "category": "Heritage",
    "duration": "4 Days / 3 Nights",
    "location": "Bangkok, Thailand"
  },
  {
    "name": "Ha Long Bay Cruise",
    "about": "Overnight on a wooden junk among limestone islands, kayak through caves and visit Hanoi's old quarter. Flights from Dhaka, cruise cabin with meals, hotel in Hanoi and transfers included.",
    "balance": "BDT 1,05,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Quang Ninh, Vietnam"
  },
  {
    "name": "Borobudur & Yogyakarta",
    "about": "Climb the Borobudur Buddhist temple at sunrise, visit Prambanan temple and the Sultan's palace in Yogyakarta. Flights from Dhaka, hotel, breakfast, temple tickets and private car included.",
    "balance": "BDT 1,15,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Java, Indonesia"
  },
  {
    "name": "Abu Dhabi Grand Mosque & Desert",
    "about": "Visit the white Sheikh Zayed Grand Mosque, Louvre Abu Dhabi and Ferrari World, plus a dune safari at sunset. Flights from Dhaka, hotel, breakfast, UAE visa and transfers included.",
    "balance": "BDT 90,000",
    "picture": "",
    "category": "Heritage",
    "duration": "4 Days / 3 Nights",
    "location": "Abu Dhabi, UAE"
  },
  {
    "name": "San Francisco & Golden Gate Bridge",
    "about": "Walk and cycle across the Golden Gate Bridge, ride the cable cars, visit Alcatraz island and Fisherman's Wharf. Flights from Dhaka, hotel, Alcatraz ticket and city pass included. US visa is applied separately.",
    "balance": "BDT 4,60,000",
    "picture": "",
    "category": "Landmark",
    "duration": "6 Days / 5 Nights",
    "location": "San Francisco, USA"
  },
  {
    "name": "Cape Town & Table Mountain",
    "about": "Take the cable car up Table Mountain, visit Cape of Good Hope, Boulders Beach penguins and Stellenbosch vineyards. Flights from Dhaka, hotel, breakfast, tours and transfers included.",
    "balance": "BDT 3,70,000",
    "picture": "",
    "category": "Mountain",
    "duration": "7 Days / 6 Nights",
    "location": "Cape Town, South Africa"
  },
  {
    "name": "Victoria Falls Safari",
    "about": "See the Victoria Falls from the Zambia and Zimbabwe sides, cruise the Zambezi at sunset and go on a Chobe game drive. Flights, lodge, park fees and guided tours included.",
    "balance": "BDT 3,40,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Victoria Falls, Zambia & Zimbabwe"
  },
  {
    "name": "Serengeti Wildlife Safari",
    "about": "Safari in 4x4 across the Serengeti plains to see lions, elephants and the great wildebeest migration, with a Ngorongoro Crater day. Flights, safari lodges, park fees, guide and meals included.",
    "balance": "BDT 5,20,000",
    "picture": "",
    "category": "Wildlife",
    "duration": "6 Days / 5 Nights",
    "location": "Serengeti, Tanzania"
  },
  {
    "name": "Cappadocia Balloon Adventure",
    "about": "Float in a hot air balloon over fairy chimneys at sunrise, stay in a cave hotel and explore Goreme and Derinkuyu underground city. Flights from Dhaka, hotel, balloon ride and tours included.",
    "balance": "BDT 1,60,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Cappadocia, Turkey"
  },
  {
    "name": "Rio & Christ the Redeemer",
    "about": "Ride the train up Corcovado to Christ the Redeemer, take the Sugarloaf cable car and walk Copacabana and Ipanema beaches. Flights, hotel, breakfast and city tours included. Brazil visa is applied separately.",
    "balance": "BDT 5,40,000",
    "picture": "",
    "category": "Landmark",
    "duration": "7 Days / 6 Nights",
    "location": "Rio de Janeiro, Brazil"
  },
  {
    "name": "Chichen Itza & Cancun",
    "about": "Visit the Mayan pyramid of Chichen Itza, swim in a cenote and relax on Cancun's white Caribbean beach. Flights, resort stay, breakfast and guided tour included. Mexico visa is applied separately.",
    "balance": "BDT 4,90,000",
    "picture": "",
    "category": "Heritage",
    "duration": "6 Days / 5 Nights",
    "location": "Yucatan, Mexico"
  },
  {
    "name": "Iguazu Falls Adventure",
    "about": "See the many waterfalls of Iguazu from both Argentina and Brazil, including the Devil's Throat, and take a boat to the falls. Flights, hotels, park entry and transfers included. Visa is applied separately.",
    "balance": "BDT 5,30,000",
    "picture": "",
    "category": "Nature",
    "duration": "6 Days / 5 Nights",
    "location": "Iguazu, Argentina & Brazil"
  },
  {
    "name": "Bora Bora Overwater Escape",
    "about": "Stay in an overwater bungalow above the clear blue lagoon, snorkel with rays and sharks and see Mount Otemanu. Flights, bungalow stay, breakfast and lagoon tour included.",
    "balance": "BDT 6,80,000",
    "picture": "",
    "category": "Island",
    "duration": "6 Days / 5 Nights",
    "location": "Bora Bora, French Polynesia"
  },
  {
    "name": "Zermatt & the Matterhorn",
    "about": "Ride the Gornergrat train for views of the Matterhorn, walk alpine trails and see Lucerne and the Swiss lakes. Flights from Dhaka, hotels, Swiss Travel Pass and Schengen visa support included.",
    "balance": "BDT 3,80,000",
    "picture": "",
    "category": "Mountain",
    "duration": "5 Days / 4 Nights",
    "location": "Zermatt, Switzerland"
  },
  {
    "name": "Neuschwanstein Castle & Munich",
    "about": "Visit the fairy-tale castle of Neuschwanstein in the Bavarian Alps, then see Munich's Marienplatz and Hofbrauhaus. Flights from Dhaka, hotel, breakfast, castle tickets and Schengen visa support included.",
    "balance": "BDT 3,10,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Bavaria, Germany"
  },
  {
    "name": "Prague & Charles Bridge",
    "about": "Walk across Charles Bridge at dawn, see Prague Castle, the Old Town Square astronomical clock and take a Vltava river cruise. Flights from Dhaka, hotel, breakfast and Schengen visa support included.",
    "balance": "BDT 2,70,000",
    "picture": "",
    "category": "City",
    "duration": "4 Days / 3 Nights",
    "location": "Prague, Czechia"
  },
  {
    "name": "Keukenhof Tulip Gardens & Amsterdam",
    "about": "See millions of tulips at Keukenhof (open in spring only, mid-March to mid-May), cruise the Amsterdam canals and visit Zaanse Schans windmills. Flights from Dhaka, hotel and Schengen visa support included.",
    "balance": "BDT 3,20,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Lisse & Amsterdam, Netherlands"
  },
  {
    "name": "Hong Kong & Victoria Peak",
    "about": "Ride the Peak Tram to Victoria Peak, take the Star Ferry across the harbour and see the Big Buddha and Ladies' Market. Flights from Dhaka, hotel, breakfast and Octopus travel card included.",
    "balance": "BDT 1,25,000",
    "picture": "",
    "category": "City",
    "duration": "4 Days / 3 Nights",
    "location": "Hong Kong"
  },
  {
    "name": "Kyoto & Fushimi Inari Shrine",
    "about": "Walk through the thousand red torii gates of Fushimi Inari, see Kiyomizu-dera and Arashiyama bamboo grove and meet Nara's deer. Flights from Dhaka, hotel, rail pass and Japan visa support included.",
    "balance": "BDT 2,60,000",
    "picture": "",
    "category": "Heritage",
    "duration": "6 Days / 5 Nights",
    "location": "Kyoto, Japan"
  },
  {
    "name": "Seoul & Gyeongbokgung Palace",
    "about": "Wear a hanbok at Gyeongbokgung Palace, see Bukchon Hanok Village, N Seoul Tower and Myeongdong street food. Flights from Dhaka, hotel, breakfast, transport card and Korea visa support included.",
    "balance": "BDT 1,90,000",
    "picture": "",
    "category": "Heritage",
    "duration": "5 Days / 4 Nights",
    "location": "Seoul, South Korea"
  },
  {
    "name": "Zhangjiajie Avatar Mountains",
    "about": "Ride the cable car and glass bridge in Zhangjiajie, the stone pillar forest that inspired the Avatar film, and see Tianmen Mountain. Flights from Dhaka, hotel, park tickets and China visa support included.",
    "balance": "BDT 1,60,000",
    "picture": "",
    "category": "Nature",
    "duration": "6 Days / 5 Nights",
    "location": "Zhangjiajie, China"
  },
  {
    "name": "Everest Base Camp Trek",
    "about": "Trek from Lukla through Sherpa villages and Namche Bazaar to Everest Base Camp with views of Mount Everest. Flights from Dhaka to Kathmandu and Lukla, guide, porter, tea-house stays, meals and permits included.",
    "balance": "BDT 2,20,000",
    "picture": "",
    "category": "Adventure",
    "duration": "12 Days / 11 Nights",
    "location": "Khumbu, Nepal"
  },
  {
    "name": "Bhutan & Tiger's Nest Monastery",
    "about": "Hike to Paro Taktsang, the cliffside monastery known as Tiger's Nest, and see Thimphu and Punakha dzong. Flights from Dhaka, 3-star hotels, all meals, guide, driver and Bhutan visa and tariff included.",
    "balance": "BDT 95,000",
    "picture": "",
    "category": "Mountain",
    "duration": "5 Days / 4 Nights",
    "location": "Paro, Bhutan"
  },
  {
    "name": "Kashmir & Dal Lake Shikara",
    "about": "Stay on a houseboat on Dal Lake, ride a shikara at sunrise, see Mughal gardens and Gulmarg's snow slopes. Flights from Dhaka via Delhi, houseboat and hotel, meals and car included. India visa help included.",
    "balance": "BDT 62,000",
    "picture": "",
    "category": "Nature",
    "duration": "5 Days / 4 Nights",
    "location": "Srinagar, India"
  },
  {
    "name": "Umrah with Makkah & Madinah",
    "about": "Perform Umrah at Masjid al-Haram in Makkah, then visit Masjid an-Nabawi in Madinah with a religious guide. Flights from Dhaka, 4-star hotels near the Haram, visa, meals and transport included.",
    "balance": "BDT 2,45,000",
    "picture": "",
    "category": "Pilgrimage",
    "duration": "10 Days / 9 Nights",
    "location": "Makkah & Madinah, Saudi Arabia"
  }
];

const now = Date.now();
db.bookings.deleteMany({});
db.services.deleteMany({});
db.services.insertMany(packages.map((p, i) => ({ ...p, createdAt: new Date(now - i * 1000) })));
print("packages: " + db.services.countDocuments() + ", bookings: " + db.bookings.countDocuments());
