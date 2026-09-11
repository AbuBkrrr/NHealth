import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

interface User {
  id: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: ('patient' | 'doctor' | 'pharmacy' | 'lab' | 'ambulance' | 'nurse')[];
  currentRole: 'patient' | 'doctor' | 'pharmacy' | 'lab' | 'ambulance' | 'nurse';
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFAEnabled: boolean;
  twoFAMethod: 'email' | 'sms' | 'authenticator' | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
}

interface LoginHistory {
  id: string;
  userId: string;
  email: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed' | 'suspicious';
  reason?: string;
  timestamp: Date;
}

interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

interface VerificationCode {
  code: string;
  userId: string;
  type: 'email' | 'sms' | '2fa';
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private emailTransporter: nodemailer.Transporter;
  private jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  private jwtExpiry = '7d';
  private refreshTokenExpiry = '30d';

  private constructor() {
    this.emailTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  // ==================== REGISTRATION ====================

  /**
   * Register new user with email/phone
   */
  async registerUser(userData: {
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
    roles: User['roles'];
  }): Promise<{ userId: string; verificationCodeSent: boolean }> {
    try {
      // Check if user exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user (would be database call)
      const userId = this.generateId();
      const user: User = {
        id: userId,
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
        currentRole: userData.roles[0],
        emailVerified: false,
        phoneVerified: false,
        twoFAEnabled: false,
        twoFAMethod: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Send verification code
      await this.sendVerificationCode(userId, userData.email, 'email');

      return {
        userId,
        verificationCodeSent: true,
      };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  // ==================== EMAIL/SMS VERIFICATION ====================

  /**
   * Send verification code via email or SMS
   */
  async sendVerificationCode(
    userId: string,
    destination: string,
    type: 'email' | 'sms'
  ): Promise<void> {
    try {
      const code = this.generateVerificationCode();

      // Store code in database (would persist to DB)
      const verificationCode: VerificationCode = {
        code,
        userId,
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        maxAttempts: 5,
      };

      if (type === 'email') {
        await this.sendEmailVerification(destination, code, userId);
      } else if (type === 'sms') {
        await this.sendSMSVerification(destination, code);
      }

      console.log(`✅ Verification code sent to ${destination}`);
    } catch (error) {
      console.error('Failed to send verification code:', error);
      throw error;
    }
  }

  /**
   * Verify email/SMS code
   */
  async verifyCode(
    userId: string,
    code: string,
    type: 'email' | 'sms'
  ): Promise<{ verified: boolean }> {
    try {
      // Would check against database
      const isValid = await this.validateVerificationCode(userId, code, type);

      if (!isValid) {
        throw new Error('Invalid or expired verification code');
      }

      // Update user as verified
      if (type === 'email') {
        await this.updateUserVerification(userId, { emailVerified: true });
      } else {
        await this.updateUserVerification(userId, { phoneVerified: true });
      }

      return { verified: true };
    } catch (error) {
      console.error('Code verification failed:', error);
      throw error;
    }
  }

  // ==================== LOGIN & SESSIONS ====================

  /**
   * Login user and create session
   */
  async login(
    email: string,
    password: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    requiresMFA: boolean;
  }> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        await this.logLoginAttempt(email, deviceName, ipAddress, 'failed', 'User not found');
        throw new Error('Invalid email or password');
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        await this.logLoginAttempt(
          email,
          deviceName,
          ipAddress,
          'failed',
          'Invalid password'
        );
        throw new Error('Invalid email or password');
      }

      // Check if email verified
      if (!user.emailVerified) {
        throw new Error('Email not verified. Please verify your email first.');
      }

      // If 2FA enabled, return requiresMFA flag
      if (user.twoFAEnabled) {
        await this.send2FACode(user.id, user.twoFAMethod!);
        return {
          accessToken: '',
          refreshToken: '',
          user: { id: user.id, email: user.email },
          requiresMFA: true,
        };
      }

      // Create session
      const sessionId = this.generateId();
      const accessToken = this.generateAccessToken(user.id);
      const refreshToken = this.generateRefreshToken(user.id);

      const session: Session = {
        id: sessionId,
        userId: user.id,
        token: refreshToken,
        deviceName,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lastActivity: new Date(),
      };

      // Store session (database call)
      await this.storeSession(session);

      // Log successful login
      await this.logLoginAttempt(email, deviceName, ipAddress, 'success');

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
          currentRole: user.currentRole,
        },
        requiresMFA: false,
      };
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Verify 2FA code and complete login
   */
  async verify2FA(
    userId: string,
    code: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const isValid = await this.validate2FACode(userId, code);
      if (!isValid) {
        throw new Error('Invalid 2FA code');
      }

      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      // Create session
      const sessionId = this.generateId();
      const accessToken = this.generateAccessToken(userId);
      const refreshToken = this.generateRefreshToken(userId);

      const session: Session = {
        id: sessionId,
        userId,
        token: refreshToken,
        deviceName,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastActivity: new Date(),
      };

      await this.storeSession(session);
      await this.logLoginAttempt(user.email, deviceName, ipAddress, 'success');

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('2FA verification failed:', error);
      throw error;
    }
  }

  /**
   * Logout from current device
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      // Invalidate refresh token in database
      await this.invalidateRefreshToken(refreshToken);
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId: string): Promise<number> {
    try {
      const invalidatedCount = await this.invalidateAllSessions(userId);
      console.log(`✅ Logged out from ${invalidatedCount} device(s)`);
      return invalidatedCount;
    } catch (error) {
      console.error('Logout all failed:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      const sessions = await this.getUserSessions(userId);
      return sessions.filter((s) => s.expiresAt > new Date());
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      throw error;
    }
  }

  // ==================== PASSWORD RESET ====================

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ resetSent: boolean }> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists (security)
        return { resetSent: true };
      }

      const resetToken = this.generateResetToken();
      const resetTokenDoc: PasswordResetToken = {
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        used: false,
      };

      // Store reset token
      await this.storePasswordResetToken(resetTokenDoc);

      // Send reset email
      await this.sendPasswordResetEmail(email, resetToken, user.firstName);

      console.log('✅ Password reset link sent to email');
      return { resetSent: true };
    } catch (error) {
      console.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    try {
      const resetToken = await this.getPasswordResetToken(token);
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        throw new Error('Invalid or expired reset token');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await this.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark token as used
      await this.markResetTokenUsed(token);

      // Logout all sessions (security)
      await this.logoutAllDevices(resetToken.userId);

      console.log('✅ Password reset successfully');
      return { success: true };
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }

  // ==================== 2FA / MFA ====================

  /**
   * Enable 2FA for user
   */
  async enable2FA(
    userId: string,
    method: 'email' | 'sms' | 'authenticator'
  ): Promise<{ secret?: string; qrCode?: string }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      if (method === 'authenticator') {
        // Generate TOTP secret
        const secret = this.generateTOTPSecret();
        const qrCode = this.generateQRCode(user.email, secret);

        return { secret, qrCode };
      }

      // For email/sms, just update the method
      await this.updateUser2FAMethod(userId, method, true);

      return {};
    } catch (error) {
      console.error('Failed to enable 2FA:', error);
      throw error;
    }
  }

  /**
   * Verify 2FA setup and enable
   */
  async verify2FASetup(userId: string, code: string): Promise<{ enabled: boolean }> {
    try {
      const isValid = await this.validateTOTPCode(userId, code);
      if (!isValid) {
        throw new Error('Invalid authentication code');
      }

      await this.updateUser2FAMethod(userId, 'authenticator', true);
      console.log('✅ 2FA enabled successfully');
      return { enabled: true };
    } catch (error) {
      console.error('2FA verification failed:', error);
      throw error;
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, password: string): Promise<{ disabled: boolean }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      // Verify password first
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }

      await this.updateUser2FAMethod(userId, null, false);
      console.log('✅ 2FA disabled');
      return { disabled: true };
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      throw error;
    }
  }

  // ==================== ROLE SWITCHING ====================

  /**
   * Switch user's active role
   */
  async switchRole(
    userId: string,
    newRole: User['currentRole']
  ): Promise<{ currentRole: string; accessToken: string }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      // Check if user has this role
      if (!user.roles.includes(newRole)) {
        throw new Error('User does not have this role');
      }

      // Update current role
      await this.updateUserRole(userId, newRole);

      // Generate new token with new role
      const accessToken = this.generateAccessToken(userId, newRole);

      console.log(`✅ Switched to role: ${newRole}`);
      return { currentRole: newRole, accessToken };
    } catch (error) {
      console.error('Role switch failed:', error);
      throw error;
    }
  }

  // ==================== LOGIN HISTORY ====================

  /**
   * Get login history for user
   */
  async getLoginHistory(userId: string, limit = 20): Promise<LoginHistory[]> {
    try {
      const history = await this.fetchLoginHistory(userId, limit);
      return history;
    } catch (error) {
      console.error('Failed to fetch login history:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious login attempt
   */
  async detectSuspiciousLogin(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const recentLogins = await this.fetchLoginHistory(userId, 5);
      const isNewIP = !recentLogins.some((login) => login.ipAddress === ipAddress);
      const isRapidLogin = recentLogins.some(
        (login) => Date.now() - login.timestamp.getTime() < 60000
      ); // 1 min

      return isNewIP || isRapidLogin;
    } catch (error) {
      console.error('Failed to detect suspicious login:', error);
      return false;
    }
  }

  // ==================== ACCOUNT DELETION ====================

  /**
   * Request account deletion (NDPA compliance)
   */
  async requestAccountDeletion(userId: string, password: string): Promise<{ deletionScheduled: boolean }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }

      // Schedule deletion for 30 days later
      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.scheduleAccountDeletion(userId, deletionDate);

      // Send confirmation email
      await this.sendDeletionConfirmationEmail(user.email, deletionDate);

      console.log('✅ Account deletion scheduled');
      return { deletionScheduled: true };
    } catch (error) {
      console.error('Account deletion request failed:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled deletion
   */
  async cancelAccountDeletion(userId: string): Promise<{ cancelled: boolean }> {
    try {
      await this.cancelScheduledDeletion(userId);
      console.log('✅ Account deletion cancelled');
      return { cancelled: true };
    } catch (error) {
      console.error('Failed to cancel deletion:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private generateAccessToken(userId: string, role?: string): string {
    return jwt.sign({ userId, role }, this.jwtSecret, { expiresIn: this.jwtExpiry });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, type: 'refresh' }, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiry,
    });
  }

  private generateVerificationCode(): string {
    return Math.random().toString().substring(2, 8);
  }

  private generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateTOTPSecret(): string {
    return randomBytes(32).toString('base64');
  }

  private generateQRCode(email: string, secret: string): string {
    // Would use qrcode library
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/NHealth:${email}?secret=${secret}`;
  }

  private async sendEmailVerification(email: string, code: string, userId: string): Promise<void> {
    await this.emailTransporter.sendMail({
      to: email,
      subject: 'Email Verification Code - N-Health',
      html: `
        <h2>Verify Your Email</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>Code expires in 10 minutes.</p>
      `,
    });
  }

  private async sendSMSVerification(phone: string, code: string): Promise<void> {
    // Would use Twilio or similar
    console.log(`SMS to ${phone}: Your verification code is ${code}`);
  }

  private async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<void> {
    await this.emailTransporter.sendMail({
      to: email,
      subject: 'Password Reset - N-Health',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p><a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">Click here to reset your password</a></p>
        <p>Link expires in 1 hour.</p>
      `,
    });
  }

  private async sendDeletionConfirmationEmail(email: string, deletionDate: Date): Promise<void> {
    await this.emailTransporter.sendMail({
      to: email,
      subject: 'Account Deletion Scheduled - N-Health',
      html: `
        <h2>Account Deletion Request Confirmed</h2>
        <p>Your account will be permanently deleted on ${deletionDate.toLocaleDateString()}.</p>
        <p>You can cancel this request anytime by logging in to your account.</p>
      `,
    });
  }

  private async send2FACode(userId: string, method: 'email' | 'sms' | 'authenticator'): Promise<void> {
    const code = this.generateVerificationCode();
    const user = await this.getUserById(userId);
    if (!user) return;

    if (method === 'email') {
      await this.sendEmailVerification(user.email, code, userId);
    } else if (method === 'sms') {
      await this.sendSMSVerification(user.phone, code);
    }
  }

  // ==================== DATABASE STUB METHODS ====================
  // These would be replaced with actual database calls

  private async getUserByEmail(email: string): Promise<User | null> {
    // Database call
    return null;
  }

  private async getUserById(userId: string): Promise<User | null> {
    // Database call
    return null;
  }

  private async updateUserVerification(userId: string, updates: any): Promise<void> {
    // Database call
  }

  private async storeSession(session: Session): Promise<void> {
    // Database call
  }

  private async getUserSessions(userId: string): Promise<Session[]> {
    // Database call
    return [];
  }

  private async invalidateRefreshToken(token: string): Promise<void> {
    // Database call
  }

  private async invalidateAllSessions(userId: string): Promise<number> {
    // Database call
    return 0;
  }

  private async storePasswordResetToken(token: PasswordResetToken): Promise<void> {
    // Database call
  }

  private async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    // Database call
    return null;
  }

  private async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    // Database call
  }

  private async markResetTokenUsed(token: string): Promise<void> {
    // Database call
  }

  private async updateUser2FAMethod(
    userId: string,
    method: any,
    enabled: boolean
  ): Promise<void> {
    // Database call
  }

  private async validateVerificationCode(userId: string, code: string, type: string): Promise<boolean> {
    // Database call
    return true;
  }

  private async validateTOTPCode(userId: string, code: string): Promise<boolean> {
    // Database call
    return true;
  }

  private async validate2FACode(userId: string, code: string): Promise<boolean> {
    // Database call
    return true;
  }

  private async updateUserRole(userId: string, role: string): Promise<void> {
    // Database call
  }

  private async fetchLoginHistory(userId: string, limit: number): Promise<LoginHistory[]> {
    // Database call
    return [];
  }

  private async logLoginAttempt(
    email: string,
    deviceName: string,
    ipAddress: string,
    status: string,
    reason?: string
  ): Promise<void> {
    // Database call
  }

  private async scheduleAccountDeletion(userId: string, date: Date): Promise<void> {
    // Database call
  }

  private async cancelScheduledDeletion(userId: string): Promise<void> {
    // Database call
  }
}

export default AuthenticationService.getInstance();
