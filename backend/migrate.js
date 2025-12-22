require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Cycle = require('./models/Cycle');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelpaladin';

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Read the existing monthData.json
    const dataPath = path.join(__dirname, '../frontend/data/monthData.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // Clear existing cycles
    await Cycle.deleteMany({});
    console.log('Cleared existing cycles');

    // Insert all months as cycles
    for (const month of data.months) {
      const cycle = new Cycle(month);
      await cycle.save();
      console.log(`Migrated cycle: ${month.name}`);
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
