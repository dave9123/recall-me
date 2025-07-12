export default function priorityNumberConversion(priority: string): number {
    switch (priority.toLowerCase()) {
        case "high":
            return 1;
        case "medium":
            return 2;
        case "low":
            return 3;
        default:
            throw new Error(`Unknown priority level: ${priority}`);
    }
}