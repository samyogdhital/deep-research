import { DBSchema, ResearchDB } from "../src/db/db";

export async function getLatestResearchFromDB(researchId: string): Promise<{ researchData: DBSchema['researches'][number], db: ResearchDB }> {

    const db = await ResearchDB.getInstance();
    const researchData = await db.getResearchData(researchId) as DBSchema['researches'][number];

    return { researchData, db };
}