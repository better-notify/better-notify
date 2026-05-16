import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { createMockTransport } from '@betternotify/core/transports';
import { whatsappChannel } from '@betternotify/whatsapp';
import type { RenderedWhatsApp } from '@betternotify/whatsapp';
import { z } from 'zod';

export const runWhatsAppMock = async (): Promise<void> => {
  const rpc = createNotify({ channels: { whatsapp: whatsappChannel() } });

  const catalog = rpc.catalog({
    orderConfirmation: rpc
      .whatsapp()
      .text()
      .input(z.object({ orderId: z.string(), total: z.string() }))
      .body(
        ({ input }) =>
          `Your order ${input.orderId} has been confirmed! Total: ${input.total}. Thank you for shopping with us.`,
      ),

    shippingPhoto: rpc
      .whatsapp()
      .image()
      .input(z.object({ orderId: z.string(), photoUrl: z.string() }))
      .url(({ input }) => input.photoUrl)
      .caption(({ input }) => `Your order ${input.orderId} is packed and ready to ship!`),

    invoice: rpc
      .whatsapp()
      .document()
      .input(z.object({ orderId: z.string(), invoiceUrl: z.string() }))
      .url(({ input }) => input.invoiceUrl)
      .filename(({ input }) => `invoice-${input.orderId}.pdf`)
      .caption('Here is your invoice.'),

    storeLocation: rpc
      .whatsapp()
      .location()
      .input(z.object({ storeName: z.string(), lat: z.number(), lng: z.number() }))
      .latitude(({ input }) => input.lat)
      .longitude(({ input }) => input.lng)
      .name(({ input }) => input.storeName)
      .address('123 Main St, São Paulo, SP'),

    feedbackRequest: rpc
      .whatsapp()
      .interactive()
      .input(z.object({ orderId: z.string() }))
      .body(({ input }) => `How was your experience with order ${input.orderId}?`)
      .header('We value your feedback')
      .footer('Reply within 24h')
      .buttons([
        { id: 'great', title: 'Great!' },
        { id: 'ok', title: 'It was OK' },
        { id: 'bad', title: 'Not good' },
      ]),

    shareContact: rpc
      .whatsapp()
      .contacts()
      .input(z.object({ agentName: z.string(), agentPhone: z.string() }))
      .contacts(({ input }) => [
        {
          name: { formatted: input.agentName },
          phones: [{ phone: input.agentPhone, type: 'WORK' }],
        },
      ]),

    ackReaction: rpc
      .whatsapp()
      .reaction()
      .input(z.object({ emoji: z.string() }))
      .emoji(({ input }) => input.emoji),
  });

  const mock = createMockTransport<RenderedWhatsApp>({
    name: 'mock-whatsapp',
    reply: (rendered) => ({ messageId: `wamid.mock-${rendered.action}` }),
  });

  const notify = createClient({
    catalog,
    transportsByChannel: { whatsapp: mock },
    logger: consoleLogger({ level: 'debug' }),
  });

  const textResult = await notify.orderConfirmation.send({
    to: '+5511999999999',
    input: { orderId: 'ORD-1234', total: 'R$ 199,90' },
  });

  console.log('text:', { messageId: textResult.messageId, data: textResult.data });

  const imageResult = await notify.shippingPhoto.send({
    to: '+5511999999999',
    input: { orderId: 'ORD-1234', photoUrl: 'https://cdn.example.com/packages/ORD-1234.jpg' },
  });

  console.log('image:', { messageId: imageResult.messageId, data: imageResult.data });

  const docResult = await notify.invoice.send({
    to: '+5511999999999',
    input: { orderId: 'ORD-1234', invoiceUrl: 'https://cdn.example.com/invoices/ORD-1234.pdf' },
  });

  console.log('document:', { messageId: docResult.messageId, data: docResult.data });

  const locationResult = await notify.storeLocation.send({
    to: '+5511999999999',
    input: { storeName: 'Loja Centro', lat: -23.5505, lng: -46.6333 },
  });

  console.log('location:', { messageId: locationResult.messageId, data: locationResult.data });

  const interactiveResult = await notify.feedbackRequest.send({
    to: '+5511999999999',
    input: { orderId: 'ORD-1234' },
  });
  console.log('interactive:', {
    messageId: interactiveResult.messageId,
    data: interactiveResult.data,
  });

  const contactResult = await notify.shareContact.send({
    to: '+5511999999999',
    input: { agentName: 'Maria Silva', agentPhone: '+5511988887777' },
  });

  console.log('contacts:', { messageId: contactResult.messageId, data: contactResult.data });

  const reactionResult = await notify.ackReaction.send({
    to: '+5511999999999',
    messageId: 'wamid.original-123',
    input: { emoji: '👍' },
  });

  console.log('reaction:', { messageId: reactionResult.messageId, data: reactionResult.data });

  const batchResult = await notify.orderConfirmation.batch([
    { to: '+5511999999999', input: { orderId: 'ORD-1001', total: 'R$ 50,00' } },
    { to: '+5511888888888', input: { orderId: 'ORD-1002', total: 'R$ 75,00' } },
  ]);

  console.log(`batch: ${batchResult.okCount} ok / ${batchResult.errorCount} errors`);

  console.log(`\nmock transport received ${mock.sent.length} messages`);
};
