// Replace every package (service) in the database with the ones in seed/packages.json.
//
//   node seed/seed.js            -> dry run: checks the data, shows what would change, touches nothing
//   node seed/seed.js --yes      -> backs up the current packages, deletes them all, inserts the new ones
//
// Needs MONGO_URI in .env (same one the server uses).
// Existing bookings are NOT touched: they keep their own saved package name and price.
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
  const old = await Service.find().lean();
  console.log(`Database has ${old.length} packages now.`);

  if (!apply) {
    console.log("Dry run only. Nothing was changed. Run again with --yes to replace them.");
    return;
  }

  const file = path.join(__dirname, `backup-services-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(old, null, 2));
  console.log(`Backup saved: ${file}`);

  const del = await Service.deleteMany({});
  console.log(`Deleted ${del.deletedCount} packages.`);
  const ins = await Service.insertMany(data);
  console.log(`Inserted ${ins.length} new packages.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
