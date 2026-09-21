import { searchRulesCoreEntity } from "./client";
import type { RulesCoreSearchMatch } from "./client";

export type ConditionSearchMatch = RulesCoreSearchMatch;

export async function searchRulesCoreConditions(
    query: string,
    limit = 10
): Promise<ConditionSearchMatch[]> {
    return await searchRulesCoreEntity(
        "condition",
        query,
        limit,
        "Rules Core condition lookup is not available right now. "
            + "You can still add the condition manually.");
}
