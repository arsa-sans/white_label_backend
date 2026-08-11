import { UserRole } from '../../database/dataStore';
export interface AuthResult {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        tenant_id: string;
        approval_status: string;
    };
}
export declare class AuthService {
    login(email: string, password: string): Promise<AuthResult>;
    registerVisitor(name: string, email: string, password: string, tenantId: string): Promise<AuthResult>;
    /**
     * Organizer register: Wajib menyertakan info event sebagai bukti verifikasi.
     * Soft validation: approval_status langsung 'approved'.
     */
    registerOrganizer(name: string, email: string, password: string, tenantId: string, eventName: string, eventDate?: string, eventLocation?: string): Promise<AuthResult>;
    register(name: string, email: string, password: string, role?: string, tenantId?: string, extraInfo?: {
        event_name?: string;
        event_date?: string;
        event_location?: string;
    }): Promise<AuthResult>;
    /**
     * Organizer membuat invitation untuk gate staff.
     * Returns invitation token yang bisa dikirim via email / ditampilkan ke organizer.
     */
    createStaffInvitation(organizerId: string, email: string, name: string, tenantId: string, eventId?: string): Promise<{
        invitation_token: string;
        email: string;
        expires_at: string;
    }>;
    acceptInvitation(token: string, password: string): Promise<AuthResult>;
    listPendingOrganizers(): Promise<{
        id: string;
        name: string;
        email: string;
        tenant_id: string;
        approval_status: import("../../database/dataStore").ApprovalStatus;
        organizer_event_name: string | undefined;
        organizer_event_date: string | undefined;
        organizer_event_location: string | undefined;
    }[]>;
    reviewOrganizer(userId: string, action: 'approved' | 'rejected'): Promise<{
        id: string;
        approval_status: string;
    }>;
    getMe(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: UserRole;
        tenant_id: string;
        approval_status: import("../../database/dataStore").ApprovalStatus;
    }>;
    private findByEmail;
    private assertEmailNotTaken;
    private generateToken;
    private sanitizeUser;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map