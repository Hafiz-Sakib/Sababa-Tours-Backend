// Finds a real photo for every package that has no "picture" yet.
// It asks Wikipedia for the lead image of the place ("wiki" title in packages.json), and if that page has no
// usable photo it searches Wikipedia with the "query" text. Photos come from Wikimedia Commons (free, real photos).
//
//   node seed/resolve-images.js          -> fills the empty pictures, saves packages.json and mongosh-reset.js
//   node seed/resolve-images.js --all    -> also replaces pictures that are already filled
//
// Needs internet and Node 18+. seed.js runs this automatically if any picture is empty.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "packages.json");
const API = "https://en.wikipedia.org/w/api.php";
const UA = { "User-Agent": "SababaToursSeed/1.0 (tour package seed script)" };
const BAD = /\.svg|map|flag|logo|locator|location|coat_of_arms|seal|symbol|icon|diagram|poster/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikipedia answers 429 when asked too fast: wait (as long as it says, or longer each time) and try again.
const call = async (params) => {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`Wikipedia answered ${res.status}`);
    const wait = Math.max(Number(res.headers.get("retry-after")) * 1000 || 0, 3000 * (attempt + 1));
    console.log(`  (Wikipedia says slow down, waiting ${Math.round(wait / 1000)}s)`);
    await sleep(wait);
  }
  throw new Error("Wikipedia kept answering 429, try again in a few minutes");
};

const good = (p) => p && p.thumbnail && p.thumbnail.source && !BAD.test(decodeURIComponent(p.thumbnail.source.split("/").pop()));

// one request for many titles (max 50): returns { "Title as written": url }
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

const bySearch = async (q) => {
  const j = await call({
    action: "query", generator: "search", gsrsearch: q, gsrlimit: "8",
    prop: "pageimages", piprop: "thumbnail", pithumbsize: "1200",
  });
  const pages = (j.query?.pages || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
  const hit = pages.find(good);
  return hit ? hit.thumbnail.source : null;
};

const toMongosh = (data) => {
  const clean = data.map(({ wiki, query, ...rest }) => rest);
  return `// Paste this whole file into mongosh (or Compass > MONGOSH tab) while connected to YOUR database.
// First run:  use <your-database-name>   (see the guide for how to find it)
// It deletes ALL bookings and ALL packages, then inserts the ${clean.length} new packages.
const packages = ${JSON.stringify(clean, null, 2)};

const now = Date.now();
db.bookings.deleteMany({});
db.services.deleteMany({});
db.services.insertMany(packages.map((p, i) => ({ ...p, createdAt: new Date(now - i * 1000) })));
print("packages: " + db.services.countDocuments() + ", bookings: " + db.bookings.countDocuments());
`;
};

async function resolveImages({ all = false } = {}) {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const todo = data.filter((d) => all || !d.picture);
  if (!todo.length) return data;
  console.log(`Looking up real photos for ${todo.length} packages on Wikipedia...`);
  const failed = [];
  let found = {};
  try {
    const titles = [...new Set(todo.map((d) => d.wiki).filter(Boolean))];
    for (let i = 0; i < titles.length; i += 25) Object.assign(found, await byTitles(titles.slice(i, i + 25)));
  } catch (e) {
    console.error(`  ${e.message}`);
  }
  for (const d of todo) {
    let url = d.wiki ? found[d.wiki] : null;
    if (!url && d.query) {
      try {
        await sleep(1500);
        url = await bySearch(d.query);
      } catch (e) {
        console.error(`  ${d.name}: ${e.message}`);
      }
    }
    if (url) {
      d.picture = url;
      console.log(`  OK   ${d.name}\n       ${url}`);
    } else {
      failed.push(d.name);
      console.log(`  NONE ${d.name} (no photo found, set "picture" by hand in packages.json)`);
    }
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n"); // save after each one, so a stop in the middle loses nothing
  }
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(path.join(__dirname, "mongosh-reset.js"), toMongosh(data));
  console.log(failed.length ? `Done. ${failed.length} without a photo.` : "Done. All packages have a photo.");
  return data;
}

module.exports = { resolveImages, toMongosh };
if (require.main === module) resolveImages({ all: process.argv.includes("--all") }).catch((e) => { console.error(e.message); process.exit(1); });
