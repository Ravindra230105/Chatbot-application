const PRICE_PER_MILLION = {
    'gpt-4.1-mini'      : { input: 0.4, output: 1.6 },
    'gpt-4o-mini'       : { input: 0.15, output: 0.6 },
    'claude-sonnet-4-5' : { input: 3, output: 15 },
    'claude-haiku-4-5'  : { input: 1, output: 5 }
};

function estimateCost(model, promptTokens, completionTokens) {
    const price = PRICE_PER_MILLION[model];

    if (!price) {
        return 0;
    }

    const cost = (promptTokens * price.input + completionTokens * price.output) / 1000000;

    return Number(cost.toFixed(6));
}

module.exports = { estimateCost };
