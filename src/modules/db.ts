import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createLogger } from "./logger";

const logger = createLogger("DB");

const db = drizzle({
    connection: {
        connectionString: process.env.DATABASE_URL!,
        ssl: process.env.DATABASE_SSL === "true"
            ? process.env.DATABASE_REJECT_UNAUTHORIZED == "true"
                ? { rejectUnauthorized: true }
                : { rejectUnauthorized: false }
            : false,
        application_name: process.env.DATABASE_APPLICATION_NAME || "recall-me",
        user: process.env.DATABASE_USER,
        host: process.env.DATABASE_HOST || "localhost",
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
    }
});

export default db;

db.execute(sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
    BEGIN
        NEW."updatedAt" := now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE TRIGGER users_update_timestamp
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

    CREATE OR REPLACE TRIGGER reminders_update_timestamp
        BEFORE UPDATE ON reminders
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

    CREATE OR REPLACE TRIGGER toNotify_update_timestamp
        BEFORE UPDATE ON "toNotify"
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
`).then(() => {
    logger.info("Database triggers created successfully.");
}).catch((error) => {
    logger.error("Error creating database triggers:", error);
    logger.error("Ensure your database schema is up to date and the connection is properly configured.");
    process.exit(1);
});