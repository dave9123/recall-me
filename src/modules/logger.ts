import winston from "winston";

export function createLogger(label: string) {
    const logger = winston.createLogger({
        level: "info",
        format: winston.format.combine(
            winston.format.label({ label }),
            winston.format.timestamp(),
            winston.format.printf(({ level, message, label: lbl, timestamp }) => {
                return `${timestamp} [${lbl}] ${level}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                dirname: "logs",
                filename: `${label.toLowerCase()}.log`,
            }),
        ],
    });

    return Object.assign(logger, {
        trace: (msg: string) => logger.log("trace", msg),
    });
}