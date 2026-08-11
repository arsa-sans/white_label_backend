export interface InviteStaffDto {
    email: string;
    name: string;
    event_id?: string;
}
export interface AcceptInvitationDto {
    token: string;
    password: string;
}
export interface RegisterOrganizerDto {
    name: string;
    email: string;
    password: string;
    event_name: string;
    event_date?: string;
    event_location?: string;
}
//# sourceMappingURL=staff.types.d.ts.map