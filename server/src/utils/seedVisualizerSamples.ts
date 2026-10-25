import { connectDB, disconnectDB } from '../config/db.js';
import { seedDefaultVisualizerSamples } from '../config/visualizerSamples.js';

async function main() {
  await connectDB();
  await seedDefaultVisualizerSamples();
  await disconnectDB();
  console.log('Visualizer samples seeded successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
