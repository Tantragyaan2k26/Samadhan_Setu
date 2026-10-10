CREATE INDEX "Complaint_citizenId_createdAt_idx"
  ON "Complaint"("citizenId", "createdAt");

CREATE INDEX "Complaint_assignedOfficerId_status_idx"
  ON "Complaint"("assignedOfficerId", "status");
