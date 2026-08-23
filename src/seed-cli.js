import { db, seedResult } from "./db.js";

console.log(`Seed complete: ${seedResult.teamAdded} team members and ${seedResult.projectsAdded} projects added.`);
db.close();
