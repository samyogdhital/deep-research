// Schema types for the deep research database

import { DBSchema } from './db';

export type FollowUpQnA = DBSchema['researches'][number]['followUps_QnA'][number]

export type ScrapedWebsite = DBSchema['researches'][number]['serpQueries'][number]['successful_scraped_websites'][number]

export type SerpQuery = DBSchema['researches'][number]['serpQueries'][number]

export type Report = DBSchema['researches'][number]['report']

export type ResearchData = DBSchema['researches'][number]