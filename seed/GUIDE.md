# Replace all packages and orders in MongoDB (50 world tour packages)

This removes ALL bookings (orders) and ALL packages, then adds the 50 new packages in `packages.json`.
Users and logins are in Firebase, so they are not touched.

Prices are per person in BDT, estimates including flights from Dhaka where the package says so (`"BDT 3,40,000"`). Edit them in `packages.json` before seeding if you want other rates.

## Pictures (real photos of each place)
`packages.json` has a `wiki` (Wikipedia page title) and `query` (search text) for every package. Packages with an empty
`picture` get a real photo of that place from Wikipedia / Wikimedia Commons the first time you run the script
(needs internet and Node 18+). The found URLs are saved into `packages.json` and `mongosh-reset.js`, so you can open
`packages.json` afterwards, check them in a browser and replace any you do not like with your own image link.

To only look up the photos (no database needed):
`node seed/resolve-images.js`   (add `--all` to replace pictures that are already filled)

## Option A: script (recommended, makes a backup first)
1. In the backend folder, make sure `.env` has `MONGO_URI` (the same one the server uses).
2. `npm install`
3. Dry run (looks up photos, changes nothing in the database, shows how many packages/bookings exist):
   `node seed/seed.js`
4. Replace everything:
   `node seed/seed.js --yes`
   It saves `backup-services-*.json` and `backup-bookings-*.json` in `seed/`, deletes both, inserts the 50 packages.
   Keep old bookings: `node seed/seed.js --yes --keep-bookings`

## Option B: by hand in MongoDB (Atlas / Compass / mongosh)
1. Run `node seed/resolve-images.js` first so every package has a photo URL.
2. Open Atlas > Database > Browse Collections, or Compass, and note the database name (the part after `.net/` in MONGO_URI). Collections: `services` (packages) and `bookings` (orders).
3. Optional backup: Compass > collection > Export Collection.
4. Open mongosh (Compass: the `>_ MONGOSH` bar at the bottom), then: `use <your-database-name>`
5. Paste the whole content of `seed/mongosh-reset.js`. It deletes bookings and packages and inserts the 50 new ones.
6. Check: `db.services.countDocuments()` should be 50 and `db.bookings.countDocuments()` should be 0.

## After
- Open the site and hard refresh. The Render backend may take about a minute to wake up.
- Running the seed twice is safe: it always deletes first, so you just get the same 50 packages.
- You can change any package picture later from the Admin Dashboard (Edit package > picture link).
