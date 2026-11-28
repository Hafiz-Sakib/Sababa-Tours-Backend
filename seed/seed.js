// Replace every package (service) AND every booking (order) with the packages in seed/packages.json.
//
//   node seed/seed.js                 -> dry run: checks the data, shows what would change, touches nothing
//   node seed/seed.js --yes           -> backs up packages + bookings, deletes both, inserts the new packages
//   node seed/seed.js --yes --keep-bookings   -> same, but leaves the bookings alone
//
// Needs MONGO_URI in .env (same one the server uses).
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  about: { type: String, required: true },
  balance: { type: String, required: true },
  picture: { type: String, required: true },
  category: { type: String, default: "General" },
  duration: { type: String, default: "Flexible" },
  location: { type: String, default: "Bangladesh" },
  createdAt: { type: Date, default: Date.now },
});
const Service = mongoose.model("Service", serviceSchema);

const parsePrice = (b) => parseFloat(String(b ?? "").replace(/[^0-9.]/g, "")) || 0;

(async () => {
  const apply = process.argv.includes("--yes");
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "packages.json"), "utf8"));

  // validate every package first
  const docs = data.map((d) => new Service(d));
  const problems = [];
  docs.forEach((doc, i) => {
    const err = doc.validateSync();
    if (err) problems.push(`#${i + 1} ${data[i].name}: ${Object.keys(err.errors).join(", ")}`);
    if (parsePrice(data[i].balance) <= 0) problems.push(`#${i + 1} ${data[i].name}: price must contain a number`);
  });
  if (problems.length) {
    console.error("Fix these first:\n" + problems.join("\n"));
    process.exit(1);
  }
  console.log(`${data.length} packages are valid.`);

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const bookingsCol = mongoose.connection.db.collection("bookings");
  const keepBookings = process.argv.includes("--keep-bookings");
  const old = await Service.find().lean();
  const oldBookings = await bookingsCol.find().toArray();
  console.log(`Database ${mongoose.connection.name} has ${old.length} packages and ${oldBookings.length} bookings now.`);

  if (!apply) {
    console.log("Dry run only. Nothing was changed. Run again with --yes to replace them.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(__dirname, `backup-services-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(old, null, 2));
  console.log(`Backup saved: ${file}`);
  if (!keepBookings) {
    const bfile = path.join(__dirname, `backup-bookings-${stamp}.json`);
    fs.writeFileSync(bfile, JSON.stringify(oldBookings, null, 2));
    console.log(`Backup saved: ${bfile}`);
    const delB = await bookingsCol.deleteMany({});
    console.log(`Deleted ${delB.deletedCount} bookings.`);
  }

  const del = await Service.deleteMany({});
  console.log(`Deleted ${del.deletedCount} packages.`);
  // the site lists newest first: the first package in the file gets the newest time so the order stays as written
  const base = Date.now();
  const ins = await Service.insertMany(data.map((d, i) => ({ ...d, createdAt: new Date(base - i * 1000) })));
  console.log(`Inserted ${ins.length} new packages.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
