import { encode } from 'gpt-tokenizer';

export class TokenTracker {
    private tokensPerQuery: Map<string, number> = new Map();
    private readonly TOKEN_THRESHOLD = 50000;
    private readonly MAX_TOTAL_TOKENS = 300000;
    private totalTokens = 0;

    addTokens(queryId: string, content: string): {
        needsCrunching: boolean;
        totalTokens: number;
        queryTokens: number
    } {
        const tokens = encode(content).length;
        const currentQueryTokens = (this.tokensPerQuery.get(queryId) || 0) + tokens;

        this.tokensPerQuery.set(queryId, currentQueryTokens);
        this.totalTokens += tokens;

        return {
            needsCrunching: currentQueryTokens >= this.TOKEN_THRESHOLD,
            totalTokens: this.totalTokens,
            queryTokens: currentQueryTokens
        };
    }

    exceedsMaxTokens(): boolean {
        return this.totalTokens >= this.MAX_TOTAL_TOKENS;
    }

    getQueryTokens(queryId: string): number {
        return this.tokensPerQuery.get(queryId) || 0;
    }

    getTotalTokens(): number {
        return this.totalTokens;
    }

    resetQueryTokens(queryId: string) {
        const oldTokens = this.tokensPerQuery.get(queryId) || 0;
        this.totalTokens -= oldTokens;
        this.tokensPerQuery.set(queryId, 0);
    }
}
