-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "company" TEXT NOT NULL,
    "companyUrl" TEXT,
    "title" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "datePosted" DATETIME,
    "dateUpdated" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "terms" TEXT,
    "category" TEXT,
    "roleKind" TEXT NOT NULL,
    "locationFit" TEXT NOT NULL,
    "locationRank" INTEGER NOT NULL,
    "inScope" BOOLEAN NOT NULL DEFAULT true,
    "relocation" BOOLEAN NOT NULL DEFAULT false,
    "topTier" BOOLEAN NOT NULL DEFAULT false,
    "sponsorshipNote" TEXT,
    "authFlag" TEXT,
    "salary" TEXT,
    "fitScore" INTEGER,
    "fitReason" TEXT,
    "rawJson" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "appliedDate" DATETIME,
    "notes" TEXT,
    "resumeVersion" TEXT,
    "salary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_url_key" ON "Job"("url");

-- CreateIndex
CREATE INDEX "Job_company_title_idx" ON "Job"("company", "title");

-- CreateIndex
CREATE INDEX "Job_locationRank_idx" ON "Job"("locationRank");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");
