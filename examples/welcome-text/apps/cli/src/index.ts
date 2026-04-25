import { createClient } from '@emailrpc/core';
import { mockProvider } from '@emailrpc/core/test';
import { emails } from '@welcome-text/emails';

const provider = mockProvider();

const mail = createClient({
  router: emails,
  providers: [{ name: 'mock', provider, priority: 1 }],
});

const result = await mail.welcome.send({
  to: 'lucas@example.com',
  input: {
    name: 'Lucas',
    verifyUrl: 'https://example.com/verify?token=abc123',
  },
});

console.log('Message ID:', result.messageId);
console.log('From:      ', result.envelope.from);
console.log('To:        ', result.envelope.to.join(', '));
console.log('Accepted:  ', result.accepted.join(', '));
console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
console.log('---');
console.log('Subject:   ', provider.sent[0]!.subject);
console.log(provider.sent[0]!.text);

const html = await mail.welcome.render(
  { name: 'Lucas', verifyUrl: 'https://example.com/verify?token=abc123' },
  { format: 'html' },
);
console.log('---');
console.log('HTML preview:', html.slice(0, 80) + '...');
