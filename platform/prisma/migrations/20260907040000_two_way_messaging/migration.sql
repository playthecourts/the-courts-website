-- Two-way messaging between The Courts and ONE family.
--
-- Separate from communications (a broadcast fanned out to many families)
-- because a parent asking "will Tuesday be made up?" is a conversation, not
-- an announcement. A thread always has exactly one family on one side and
-- The Courts on the other, so there is no shape here that could become a
-- parent-to-parent channel.

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('open', 'resolved');

-- CreateTable
CREATE TABLE "message_threads" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "offering_id" TEXT,
    "session_id" TEXT,
    "athlete_id" TEXT,
    "communication_id" TEXT,
    "status" "ThreadStatus" NOT NULL DEFAULT 'open',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_guardian_id" TEXT,
    "author_staff_id" TEXT,
    "read_by_family_at" TIMESTAMP(3),
    "read_by_staff_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_threads_family_id_last_message_at_idx" ON "message_threads"("family_id", "last_message_at");

-- CreateIndex
CREATE INDEX "message_threads_status_last_message_at_idx" ON "message_threads"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "messages_thread_id_created_at_idx" ON "messages"("thread_id", "created_at");

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_guardian_id_fkey" FOREIGN KEY ("author_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_staff_id_fkey" FOREIGN KEY ("author_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

