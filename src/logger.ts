import winston from "winston";

export function createLogger(label: string) {
    return winston.createLogger({
        level: "info",
        format: winston.format.combine(
            winston.format.label({ label }),
            winston.format.timestamp(),
            winston.format.printf(({ level, message, label, timestamp }) => {
                return `${timestamp} [${label}] ${level}: ${message}`;
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
}