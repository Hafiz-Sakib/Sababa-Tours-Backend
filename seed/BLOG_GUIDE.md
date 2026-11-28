# Travel Blog: database table (collection) and seed

New MongoDB collection: **`blogs`** (Mongoose model `Blog` in `server.js`). Nothing else changes: `services` (packages)
and `bookings` stay as they are. You do **not** create the collection by hand, MongoDB creates it on the first insert.

## Schema (`blogs`)
| field | type | notes |
|---|---|---|
| `title` | String, required | max 160 chars |
| `slug` | String, required, **unique** | made from the title (`schengen-visa-...`), used to avoid duplicates when seeding |
| `category` | String | e.g. `Travel Tips`, `Visa & Documents`, `Destination Guide` (free text, tabs on the site are built from it) |
| `excerpt` | String, required | short summary on the card, max 400 chars |
| `body` | [String], required | one string per paragraph |
| `image` | String | cover photo URL (empty = a gradient card with the category) |
| `author` | String | default `Sababa Travel Desk` |
| `tags` | [String] | used by the search box |
| `readMinutes` | Number | calculated from the body (200 words per minute) |
| `featured` | Boolean | the big top story. Only one at a time: featuring one un-features the others |
| `published` | Boolean | `false` = draft, hidden from the public site, still visible to the admin |
| `publishedAt` | Date | shown as "Nov 2026" on the card |
| `createdAt`, `updatedAt` | Date | added automatically |

## API (added to `server.js`)
- `GET  /api/blogs` public, published posts only
- `GET  /api/blogs/:idOrSlug` public, one post
- `GET  /api/admin/blogs` admin, all posts including drafts
- `POST /api/admin/blogs` admin, create
- `PATCH /api/admin/blogs/:id` admin, edit (also used by Publish / Unpublish)
- `DELETE /api/admin/blogs/:id` admin, delete

## Option A: script (recommended)
1. `.env` must have `MONGO_URI` (same as the server).
2. `npm install`
3. `node seed/seed-blogs.js` (or `npm run seed:blogs`)
   - adds the 14 posts in `seed/blogs.json`, or updates them if they exist (matched by `slug`)
   - looks up a real cover photo for each post on Wikipedia the first time (needs internet), and saves the URLs back into `blogs.json`
   - does **not** touch packages or bookings, and does not delete the blogs you wrote in the admin panel
4. Start over with only these posts: `node seed/seed-blogs.js --reset` (deletes ALL blogs first)
5. Only fetch the photos: `node seed/seed-blogs.js --images`

## Option B: by hand in MongoDB (Atlas / Compass / mongosh)
1. Run `node seed/seed-blogs.js --images` once so `mongosh-blogs.js` has the photo URLs.
2. Open mongosh, `use <your-database-name>`, paste the whole `seed/mongosh-blogs.js`.
3. Check: `db.blogs.countDocuments()` should be 14.

## Add a blog without any seed
Log in as the admin, open **Admin > Blog > Add blog** (or press "Write a new blog" on the Travel Blog page).
Fill the title, category, summary and article (blank line between paragraphs), paste a cover image link and press Publish.
It is saved to the `blogs` collection straight away.

## After
Deploy the backend (Render) first, then the website. Until the backend has the new routes, the Travel Blog page
shows the 3 built-in articles from `src/data/travel.js`.
