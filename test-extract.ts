import { db } from "./src/lib/db";
import { extractProfile } from "./src/lib/onboarding/extract";

async function run() {
  const learner = await db.learner.findFirst();
  if (!learner) return console.log("No learner");
  console.log("Learner ID:", learner.id);
  const profile = await extractProfile(learner.id);
  console.log("Extracted Profile:", profile);
  
  const learnerData = await db.learner.findUnique({ where: { id: learner.id } });
  console.log("DB Learner Data:", learnerData?.goalSkillId, learnerData?.goalStatement);
}
run();
