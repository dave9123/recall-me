import { drizzle } from "drizzle-orm/node-postgres";

export default drizzle({
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