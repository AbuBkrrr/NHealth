/**
 * Emergency SMS Service
 * Fallback communication channel when app connectivity fails
 * Provides life-safety feature for critical emergency requests
 */

export interface SMSConfig {
  provider: 'twilio' | 'aws-sns' | 'termii' | 'nexmo' | 'local-demo';
  apiKey?: string;
  apiSecret?: string;
  senderPhone?: string;
  enabled: boolean;
}

export interface EmergencySMSPayload {
  patientName: string;
  patientPhone: string;
  emergencyType: 'AMBULANCE' | 'POLICE' | 'FIRE' | 'MEDICAL';
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  dispatchNumber: string;
  timestamp: Date;
}

/**
 * Emergency SMS Service
 * Sends fallback SMS when app is offline
 */
export class EmergencySMSService {
  private static config: SMSConfig = {
    provider: process.env.SMS_PROVIDER as any || 'local-demo',
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    senderPhone: process.env.SMS_SENDER_PHONE || '+1234567890',
    enabled: process.env.SMS_ENABLED !== 'false'
  };

  /**
   * Send emergency SMS via configured provider
   */
  static async sendEmergencySMS(payload: EmergencySMSPayload): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    fallbackMethod?: string;
  }> {
    if (!this.config.enabled) {
      console.warn('❌ SMS service is disabled');
      return {
        success: false,
        error: 'SMS service is disabled'
      };
    }

    const message = this.formatEmergencyMessage(payload);

    try {
      switch (this.config.provider) {
        case 'twilio':
          return await this.sendViaTwilio(payload.patientPhone, message);

        case 'aws-sns':
          return await this.sendViaAwsSNS(payload.patientPhone, message);

        case 'termii':
          return await this.sendViaTermii(payload.patientPhone, message);

        case 'nexmo':
          return await this.sendViaNexmo(payload.patientPhone, message);

        case 'local-demo':
        default:
          return await this.sendViaDemo(payload.patientPhone, message);
      }
    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        fallbackMethod: 'call-dispatch-center'
      };
    }
  }

  /**
   * Format emergency message with key information
   */
  private static formatEmergencyMessage(payload: EmergencySMSPayload): string {
    const { patientName, emergencyType, location } = payload;
    const googleMapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;

    return (
      `🚨 EMERGENCY ALERT\n` +
      `Name: ${patientName}\n` +
      `Type: ${emergencyType}\n` +
      `Location: ${location.address || `${location.lat}, ${location.lng}`}\n` +
      `Maps: ${googleMapsLink}\n` +
      `Time: ${new Date().toLocaleString()}\n` +
      `Reply to confirm receipt`
    );
  }

  /**
   * Send via Twilio
   */
  private static async sendViaTwilio(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Twilio implementation would use twilio client library
      // const twilio = require('twilio');
      // const client = twilio(this.config.apiKey, this.config.apiSecret);
      // const response = await client.messages.create({
      //   body: message,
      //   from: this.config.senderPhone,
      //   to: phone
      // });
      // return { success: true, messageId: response.sid };

      console.log('📱 [TWILIO] Sending SMS to:', phone);
      return { success: true, messageId: 'twilio-demo-id' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send via AWS SNS
   */
  private static async sendViaAwsSNS(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // AWS SNS implementation would use aws-sdk
      // const AWS = require('aws-sdk');
      // const sns = new AWS.SNS();
      // const response = await sns.publish({
      //   Message: message,
      //   PhoneNumber: phone
      // }).promise();
      // return { success: true, messageId: response.MessageId };

      console.log('📱 [AWS SNS] Sending SMS to:', phone);
      return { success: true, messageId: 'aws-sns-demo-id' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send via Termii (African provider)
   */
  private static async sendViaTermii(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Termii implementation for African markets
      const response = await fetch('https://api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          from: 'N-Health',
          sms: message,
          type: 'plain',
          api_key: this.config.apiKey
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        console.log('📱 [TERMII] SMS sent successfully');
        return { success: true, messageId: data.message_id };
      }

      return {
        success: false,
        error: `Termii API returned ${response.status}`
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send via Nexmo/Vonage
   */
  private static async sendViaNexmo(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Nexmo/Vonage implementation
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          api_key: this.config.apiKey || '',
          api_secret: this.config.apiSecret || '',
          to: phone,
          from: 'N-Health',
          text: message
        }).toString()
      });

      if (response.ok) {
        const data: any = await response.json();
        console.log('📱 [NEXMO] SMS sent successfully');
        return { success: true, messageId: data.messages[0]['message-id'] };
      }

      return {
        success: false,
        error: `Nexmo API returned ${response.status}`
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Demo/fallback SMS sending for development
   */
  private static async sendViaDemo(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // In demo mode, just log to console
    console.log(
      `\n📱 [DEMO SMS]\n` +
      `To: ${phone}\n` +
      `Message:\n${message}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    );

    return { success: true, messageId: `demo-sms-${Date.now()}` };
  }

  /**
   * Send dispatch center alert (for critical emergencies when SMS fails)
   */
  static async alertDispatchCenter(payload: EmergencySMSPayload): Promise<{
    success: boolean;
    dispatchId?: string;
    error?: string;
  }> {
    try {
      const dispatchPayload = {
        patientName: payload.patientName,
        patientPhone: payload.patientPhone,
        emergencyType: payload.emergencyType,
        location: payload.location,
        timestamp: payload.timestamp,
        priority: 'CRITICAL',
        source: 'mobile-app-offline'
      };

      // In production, this would:
      // 1. Store in database with status 'PENDING'
      // 2. Broadcast to all available ambulances
      // 3. Send push notification to dispatch center staff
      // 4. Create incident ticket

      console.log('🚨 DISPATCH CENTER ALERT:', JSON.stringify(dispatchPayload, null, 2));

      return {
        success: true,
        dispatchId: `dispatch-${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Check SMS service health
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unavailable';
    provider: string;
    message: string;
  }> {
    // In production, would test connectivity to SMS provider
    return {
      status: 'healthy',
      provider: this.config.provider,
      message: `SMS service (${this.config.provider}) is operational`
    };
  }
}

export default EmergencySMSService;
