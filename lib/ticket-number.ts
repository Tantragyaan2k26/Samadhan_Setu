import { Prisma } from '@prisma/client';

/** A globally increasing PostgreSQL sequence; the year is a display prefix and does not reset numbering. */
export async function nextTicketNo(tx: Prisma.TransactionClient, year = new Date().getFullYear()) {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('"Complaint_ticket_no_seq"') AS value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Ticket number sequence did not return a value');
  return `UK-${year}-${value.toString().padStart(6, '0')}`;
}
