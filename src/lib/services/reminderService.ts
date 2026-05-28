import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { BillingService } from './billingService';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function runReminderSweep(): Promise<{ reminded: number; markedOverdue: number }> {
  const target = new Date();
  target.setDate(target.getDate() + 3);
  const targetIso = target.toISOString().slice(0, 10);

  const upcomingBills = await BillingService.findOverdueAndUpcoming(targetIso);
  const appUsers = await db.select().from(users);
  logger.info(
    { upcoming: upcomingBills.length, recipients: appUsers.length, until: targetIso },
    'reminder sweep starting',
  );

  let reminded = 0;
  await Promise.all(
    upcomingBills.flatMap((bill: any) => {
      const customer = bill.Rental?.Customer;
      if (!customer) return [];
      const customerEmailLabel = customer.email ? ` (${customer.email})` : '';
      return appUsers.map(async (user) => {
        if (!user.email) return;
        const subject = `Upcoming Bill Reminder: ${customer.firstName} ${customer.lastName}`;
        const text = `Attention: Customer ${customer.firstName} ${customer.lastName}${customerEmailLabel} has a pending bill of Rs.${bill.amount} due on ${bill.dueDate}.`;
        const html = `
          <h2>Upcoming Bill Reminder</h2>
          <p><strong>Customer:</strong> ${customer.firstName} ${customer.lastName}${customerEmailLabel}</p>
          <p><strong>Amount Due:</strong> Rs.${bill.amount}</p>
          <p><strong>Due Date:</strong> ${bill.dueDate}</p>
          <p>Please ensure the payment is collected before the deadline.</p>
        `;
        try {
          await sendEmail(user.email, subject, text, html);
          reminded += 1;
        } catch (err) {
          // Per-recipient failures are logged but do not abort the sweep.
          logger.error(
            { err, recipient: user.email, billingId: bill.id },
            'reminder email failed',
          );
        }
      });
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const markedOverdue = await BillingService.markOverdue(today);

  logger.info({ reminded, markedOverdue }, 'reminder sweep complete');
  return { reminded, markedOverdue };
}
