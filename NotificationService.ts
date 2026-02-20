export class NotificationService {
  // Mock Email/SMS Service
  
  async sendBillCreated(email: string, bill: any) {
    console.log(`[EMAIL] To: ${email}`);
    console.log(`Subject: New Bill Generated`);
    console.log(`Body: A new bill of ${bill.amount} is generated. Due date: ${bill.dueDate}`);
    // Integration with SendGrid/Twilio would go here
  }

  async sendBillOverdue(email: string, bill: any, lateFee: number) {
    console.log(`[EMAIL] To: ${email}`);
    console.log(`Subject: Bill Overdue Notice`);
    console.log(`Body: Your bill is overdue. A late fee of ${lateFee} has been applied.`);
    
    console.log(`[SMS] Sending SMS alert to user for overdue bill ${bill.id}`);
  }
}