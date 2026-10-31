import { searchRulesCoreEntity } from "./client.js";
import type { RulesCoreSearchMatch } from "./client.js";

export type ConditionSearchMatch = RulesCoreSearchMatch;

export async function searchRulesCoreConditions(
    query: string,
    limit = 10
): Promise<ConditionSearchMatch[]> {
    return searchRulesCoreEntity(["condition", "leveled-condition"], query, limit);
}
