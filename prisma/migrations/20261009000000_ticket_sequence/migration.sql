-- Ticket numbers use a globally increasing sequence; the year remains a display prefix.
CREATE SEQUENCE "Complaint_ticket_no_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Start above every numeric suffix already stored, including legacy ticket numbers.
SELECT setval(
  '"Complaint_ticket_no_seq"',
  COALESCE(MAX(NULLIF(substring("ticketNo" from '^UK-[0-9]{4}-([0-9]+)$'), '')::BIGINT), 0) + 1,
  false
)
FROM "Complaint";
