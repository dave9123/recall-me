CREATE TABLE "notified" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notified_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reminderId" integer NOT NULL,
	"userId" varchar NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"provider" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"uid" varchar NOT NULL,
	"ownerId" varchar NOT NULL,
	"title" varchar NOT NULL,
	"priority" integer,
	"description" varchar,
	"time" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"uid" varchar NOT NULL,
	"username" varchar NOT NULL,
	"authData" varchar,
	"provider" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "notified" ADD CONSTRAINT "notified_reminderId_reminders_id_fk" FOREIGN KEY ("reminderId") REFERENCES "public"."reminders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notified" ADD CONSTRAINT "notified_userId_users_uid_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_ownerId_users_uid_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;