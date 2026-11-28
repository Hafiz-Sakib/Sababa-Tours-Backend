// Adds the Travel Blog posts in seed/blogs.json to MongoDB (collection "blogs").
// Packages and bookings are NOT touched.
//
//   node seed/seed-blogs.js            -> add new posts and update existing ones (matched by slug). Safe to run again.
//   node seed/seed-blogs.js --reset    -> delete ALL blogs first (admin-written ones too), then insert these
//   node seed/seed-blogs.js --images   -> only look up cover photos, no database needed
//
// Cover photos: every post has a "wiki" (Wikipedia page title). Posts with an empty "image" get the lead photo of
// that page from Wikipedia / Wikimedia Commons (free, real photos). Needs internet and Node 18+.
// The found URLs are saved in blogs.json and mongosh-blogs.js, so you can check them and swap any you do not like.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const FILE = path.join(__dirname, "blogs.json");
const API = "https://en.wikipedia.org/w/api.php";
const UA = { "User-Agent": "SababaToursSeed/1.0 (blog seed script)" };
const BAD = /\.svg|map|flag|logo|locator|location|coat_of_arms|seal|symbol|icon|diagram|poster/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugify = (t) =>
  String(t).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const readMinutes = (paras) => Math.max(1, Math.round(paras.join(" ").split(/\s+/).filter(Boolean).length / 200));

const call = async (params) => {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`Wikipedia answered ${res.status}`);
    await sleep(Math.max(Number(res.headers.get("retry-after")) * 1000 || 0, 3000 * (attempt + 1)));
  }
  throw new Error("Wikipedia kept answering 429, try again in a few minutes");
};
const good = (p) => p && p.thumbnail && p.thumbnail.source && !BAD.test(decodeURIComponent(p.thumbnail.source.split("/").pop()));

const byTitles = async (titles) => {
  const j = await call({ action: "query", redirects: "1", prop: "pageimages", piprop: "thumbnail", pithumbsize: "1200", titles: titles.join("|") });
  const map = {};
  (j.query?.redirects || []).forEach((r) => (map[r.to] = r.from));
  (j.query?.normalized || []).forEach((n) => (map[n.to] = n.from));
  const out = {};
  (j.query?.pages || []).forEach((p) => {
    if (!good(p)) return;
    let t = p.title;
    while (map[t]) t = map[t];
    out[t] = p.thumbnail.source;
  });
  return out;
};

const toMongosh = (docs) => `// Paste this whole file into mongosh (or the Compass MONGOSH tab) while connected to YOUR database.
// First run:  use <your-database-name>
// Adds / updates ${docs.length} blog posts (matched by slug). Packages and bookings are not touched.
const blogs = ${JSON.stringify(docs, null, 2)};

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
`;

const load = () => JSON.parse(fs.readFileSync(FILE, "utf8"));
const toDocs = (data) =>
  data.map(({ wiki, body, ...d }) => ({
    ...d,
    slug: slugify(d.title),
    body,
    readMinutes: readMinutes(body),
  }));

async function resolveImages() {
  const data = load();
  const todo = data.filter((d) => !d.image && d.wiki);
  if (todo.length) {
    console.log(`Looking up cover photos for ${todo.length} posts on Wikipedia...`);
    try {
      const titles = [...new Set(todo.map((d) => d.wiki))];
      const found = {};
      for (let i = 0; i < titles.length; i += 25) Object.assign(found, await byTitles(titles.slice(i, i + 25)));
      todo.forEach((d) => {
        if (found[d.wiki]) {
          d.image = found[d.wiki];
          console.log(`  OK   ${d.title}`);
        } else console.log(`  NONE ${d.title} (set "image" by hand in blogs.json, or in the admin Blog tab)`);
      });
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
    } catch (e) {
      console.error(`  ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, "mongosh-blogs.js"), toMongosh(toDocs(load())));
  return load();
}

(async () => {
  await resolveImages();
  if (process.argv.includes("--images")) return console.log("Photos saved in blogs.json and mongosh-blogs.js.");

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }
  const docs = toDocs(load());
  const Blog = mongoose.model(
    "BlogSeed",
    new mongoose.Schema({}, { strict: false, timestamps: true }),
    "blogs",
  );
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database ${mongoose.connection.name} has ${await Blog.countDocuments()} blogs now.`);

  if (process.argv.includes("--reset")) {
    const del = await Blog.deleteMany({});
    console.log(`Deleted ${del.deletedCount} blogs.`);
  }
  // only one featured post at a time
  const featured = docs.filter((d) => d.featured);
  if (featured.length > 1) featured.slice(1).forEach((d) => (d.featured = false));

  let added = 0;
  let updated = 0;
  for (const d of docs) {
    const { publishedAt, ...rest } = d;
    const r = await Blog.updateOne(
      { slug: d.slug },
      { $set: { ...rest, publishedAt: new Date(publishedAt) } },
      { upsert: true },
    );
    if (r.upsertedCount) added++;
    else updated++;
  }
  await mongoose.connection.db.collection("blogs").createIndex({ slug: 1 }, { unique: true });
  if (featured.length) await Blog.updateMany({ slug: { $ne: featured[0].slug } }, { $set: { featured: false } });
  console.log(`Done. ${added} added, ${updated} updated. Blogs in database: ${await Blog.countDocuments()}.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
