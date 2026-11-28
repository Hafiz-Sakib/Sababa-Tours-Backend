# Replace all packages and orders in MongoDB

This removes ALL bookings (orders) and ALL packages, then adds the 30 packages in `packages.json`.
Users and logins are in Firebase, so they are not touched.

## Option A: script (recommended, makes a backup first)
1. In the backend folder, make sure `.env` has `MONGO_URI` (the same one the server uses).
2. `npm install`
3. Dry run (changes nothing, shows how many packages/bookings exist):
   `node seed/seed.js`
4. Replace everything:
   `node seed/seed.js --yes`
   It saves `backup-services-*.json` and `backup-bookings-*.json` in `seed/`, deletes both, inserts 30 packages.
   Keep old bookings: `node seed/seed.js --yes --keep-bookings`

## Option B: by hand in MongoDB (Atlas / Compass / mongosh)
1. Open Atlas > Database > Browse Collections, or Compass, and note the database name (the part after `.net/` in MONGO_URI). Collections: `services` (packages) and `bookings` (orders).
2. Optional backup: Compass > collection > Export Collection.
3. Open mongosh (Compass: the `>_ MONGOSH` bar at the bottom), then:
   `use <your-database-name>`
4. Paste the whole content of `seed/mongosh-reset.js`. It deletes bookings and packages and inserts the 30 new ones.
5. Check: `db.services.countDocuments()` should be 30 and `db.bookings.countDocuments()` should be 0.

## After
- Open the site and hard refresh. The Render backend may take about a minute to wake up.
- Do not seed twice by accident: the script always deletes first, so running it again just gives the same 30 packages.
- Prices are in `packages.json` as `"BDT 6,500"` per person. Change them there before seeding if you want other rates.
