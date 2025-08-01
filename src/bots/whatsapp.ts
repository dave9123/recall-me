import makeWASocket from "baileys";
import { createLogger } from "../modules/logger";

const logger = createLogger("WhatsApp");

const sock = makeWASocket({
    logger: logger,
});
