import { createNotify, createClient } from '@betternotify/core';
import { withEventLogger } from '@betternotify/core/middlewares';
import { inMemoryEventSink } from '@betternotify/core/sinks';
import { emailChannel, mockTransport } from '@betternotify/email';
import { smsChannel, mockSmsTransport } from '@betternotify/sms';
import { pushChannel, mockPushTransport } from '@betternotify/push';
import { z } from 'zod';

export const runMultiChannel = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { email: emailChannel(), sms: smsChannel(), push: pushChannel() },
  });

  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .from('hello@example.com')
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(({ input }) => ({
        html: `<p>Welcome, ${input.name}!</p>`,
        text: `Welcome, ${input.name}!`,
      })),
    welcomeSms: rpc
      .use(withEventLogger({ sink: inMemoryEventSink() }))
      .sms()
      .input(z.object({ name: z.string() }))
      .body(({ input }) => `Welcome, ${input.name}! Reply STOP to opt out.`),
    welcomePush: rpc
      .push()
      .input(z.object({ name: z.string() }))
      .title('Welcome')
      .body(({ input }) => `Hi ${input.name}, your account is ready.`)
      .data({ deeplink: '/onboarding' }),
  });

  const emailMock = mockTransport();
  const smsMock = mockSmsTransport();
  const pushMock = mockPushTransport();

  const notify = createClient({
    catalog,
    channels: { email: emailChannel(), sms: smsChannel(), push: pushChannel() },
    transportsByChannel: {
      email: emailMock,
      sms: smsMock,
      push: pushMock,
    },
  });

  const emailResult = await notify.welcome.send({
    to: 'lucas@example.com',
    input: { name: 'Lucas' },
  });
  const smsResult = await notify.welcomeSms.send({
    to: '+15555555555',
    input: { name: 'Lucas' },
  });
  const pushResult = await notify.welcomePush.send({
    to: 'device-token-abc',
    input: { name: 'Lucas' },
  });

  console.log('email:', { messageId: emailResult.messageId, data: emailResult.data });
  console.log('sms:  ', { messageId: smsResult.messageId, data: smsResult.data });
  console.log('push: ', { messageId: pushResult.messageId, data: pushResult.data });
  console.log('---');
  console.log('email rendered:', emailMock.sent[0]);
  console.log('sms rendered:  ', smsMock.messages[0]);
  console.log('push rendered: ', pushMock.messages[0]);
};
