const RULES = [
    { label: 'email', pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, mask: '[EMAIL]' },
    { label: 'card', pattern: /\b(?:\d[ -]*?){13,19}\b/g, mask: '[CARD]' },
    { label: 'aadhaar', pattern: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, mask: '[AADHAAR]' },
    { label: 'pan', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, mask: '[PAN]' },
    { label: 'phone', pattern: /(?:\+\d{1,3}[ -]?)?\b\d{10}\b/g, mask: '[PHONE]' },
    { label: 'apiKey', pattern: /\b(?:sk|pk)-[A-Za-z0-9_-]{16,}\b/g, mask: '[API_KEY]' }
];

function redactText(text) {
    if (!text) {
        return { text: '', redacted: false, labels: [] };
    }

    let output = text;
    const labels = [];

    RULES.forEach(rule => {
        rule.pattern.lastIndex = 0;

        if (rule.pattern.test(output)) {
            rule.pattern.lastIndex = 0;
            output = output.replace(rule.pattern, rule.mask);
            labels.push(rule.label);
        }
    });

    return { text: output, redacted: labels.length > 0, labels };
}

module.exports = { redactText };
