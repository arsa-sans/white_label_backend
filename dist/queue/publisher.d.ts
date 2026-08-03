export interface DomainEvent<T = unknown> {
    eventType: string;
    tenantId: string;
    payload: T;
    timestamp: string;
}
export declare function publishEvent<T>(routingKey: string, payload: T, tenantId: string): Promise<boolean>;
//# sourceMappingURL=publisher.d.ts.map