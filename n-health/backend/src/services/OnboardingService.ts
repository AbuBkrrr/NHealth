interface OnboardingStep {
  step: number;
  name: string;
  completed: boolean;
  skippable: boolean;
}

interface PatientOnboarding {
  userId: string;
  medicalHistory?: string;
  allergies?: string[];
  currentMedications?: Array<{ name: string; dosage: string; frequency: string }>;
  emergencyContact?: { name: string; phone: string; relationship: string };
  bloodType?: string;
  insuranceProvider?: string;
  nhisNumber?: string;
}

interface DoctorOnboarding {
  userId: string;
  licenseNumber: string;
  specialization: string;
  yearsOfExperience: number;
  consultationFee: number;
  qualifications?: string[];
  clinicAddress?: string;
  availableHours?: { day: string; start: string; end: string }[];
  bio?: string;
  profileImage?: string;
}

interface PharmacyOnboarding {
  userId: string;
  pharmacyName: string;
  licenseNumber: string;
  address: string;
  phone: string;
  operatingHours?: { day: string; start: string; end: string }[];
  deliveryEnabled: boolean;
  deliveryRadius?: number;
}

export class OnboardingService {
  private static instance: OnboardingService;

  private constructor() {}

  static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  // ==================== PATIENT ONBOARDING ====================

  /**
   * Get patient onboarding steps
   */
  getPatientOnboardingSteps(): OnboardingStep[] {
    return [
      { step: 1, name: 'Medical History', completed: false, skippable: false },
      { step: 2, name: 'Allergies', completed: false, skippable: true },
      { step: 3, name: 'Current Medications', completed: false, skippable: true },
      { step: 4, name: 'Emergency Contact', completed: false, skippable: false },
      { step: 5, name: 'Insurance Details', completed: false, skippable: true },
      { step: 6, name: 'Profile Photo', completed: false, skippable: true },
    ];
  }

  /**
   * Complete patient onboarding step
   */
  async completePatientOnboarding(
    userId: string,
    data: PatientOnboarding
  ): Promise<{ success: boolean; nextStep?: number }> {
    try {
      // Validate required fields
      if (!data.medicalHistory || !data.emergencyContact) {
        throw new Error('Required fields missing');
      }

      // Store onboarding data
      await this.storePatientOnboarding(userId, data);

      // Mark user as onboarded
      await this.markUserOnboarded(userId, 'patient');

      console.log('✅ Patient onboarding completed');
      return { success: true };
    } catch (error) {
      console.error('Patient onboarding failed:', error);
      throw error;
    }
  }

  // ==================== DOCTOR ONBOARDING ====================

  /**
   * Get doctor onboarding steps
   */
  getDoctorOnboardingSteps(): OnboardingStep[] {
    return [
      { step: 1, name: 'License Verification', completed: false, skippable: false },
      { step: 2, name: 'Specialization', completed: false, skippable: false },
      { step: 3, name: 'Consultation Fee', completed: false, skippable: false },
      { step: 4, name: 'Available Hours', completed: false, skippable: false },
      { step: 5, name: 'Professional Bio', completed: false, skippable: true },
      { step: 6, name: 'Profile Photo', completed: false, skippable: false },
      { step: 7, name: 'Bank Details', completed: false, skippable: false },
    ];
  }

  /**
   * Verify doctor license
   */
  async verifyDoctorLicense(userId: string, licenseNumber: string): Promise<{
    valid: boolean;
    doctorName?: string;
    specialization?: string;
    status?: string;
  }> {
    try {
      // Would call external MDCN/registration board API
      const isValid = await this.validateMDCNLicense(licenseNumber);

      if (!isValid) {
        throw new Error('Invalid or unverified license number');
      }

      const licenseDetails = await this.fetchLicenseDetails(licenseNumber);

      return {
        valid: true,
        doctorName: licenseDetails.name,
        specialization: licenseDetails.specialization,
        status: licenseDetails.status,
      };
    } catch (error) {
      console.error('License verification failed:', error);
      throw error;
    }
  }

  /**
   * Complete doctor onboarding
   */
  async completeDoctorOnboarding(
    userId: string,
    data: DoctorOnboarding
  ): Promise<{ success: boolean; approvalPending: boolean }> {
    try {
      // Validate required fields
      const required = ['licenseNumber', 'specialization', 'consultationFee', 'availableHours'];
      for (const field of required) {
        if (!data[field as keyof DoctorOnboarding]) {
          throw new Error(`${field} is required`);
        }
      }

      // Verify license
      const licenseVerification = await this.verifyDoctorLicense(userId, data.licenseNumber);
      if (!licenseVerification.valid) {
        throw new Error('License verification failed');
      }

      // Store doctor profile
      await this.storeDoctorOnboarding(userId, data);

      // Set approval pending status
      await this.setDoctorApprovalStatus(userId, 'pending');

      console.log('✅ Doctor onboarding submitted for approval');
      return { success: true, approvalPending: true };
    } catch (error) {
      console.error('Doctor onboarding failed:', error);
      throw error;
    }
  }

  /**
   * Get doctor profile completion percentage
   */
  async getDoctorProfileCompletion(userId: string): Promise<number> {
    try {
      const profile = await this.getDoctorProfile(userId);
      let completed = 0;
      const total = 6;

      if (profile.licenseNumber) completed++;
      if (profile.specialization) completed++;
      if (profile.consultationFee) completed++;
      if (profile.availableHours?.length) completed++;
      if (profile.bio) completed++;
      if (profile.profileImage) completed++;

      return Math.round((completed / total) * 100);
    } catch (error) {
      console.error('Failed to calculate profile completion:', error);
      return 0;
    }
  }

  // ==================== PHARMACY ONBOARDING ====================

  /**
   * Get pharmacy onboarding steps
   */
  getPharmacyOnboardingSteps(): OnboardingStep[] {
    return [
      { step: 1, name: 'Pharmacy Details', completed: false, skippable: false },
      { step: 2, name: 'License Verification', completed: false, skippable: false },
      { step: 3, name: 'Operating Hours', completed: false, skippable: false },
      { step: 4, name: 'Delivery Setup', completed: false, skippable: true },
      { step: 5, name: 'Bank Details', completed: false, skippable: false },
    ];
  }

  /**
   * Verify pharmacy license
   */
  async verifyPharmacyLicense(pharmacyName: string, licenseNumber: string): Promise<{
    valid: boolean;
    registeredName?: string;
  }> {
    try {
      // Would call NAFDAC/regulatory API
      const isValid = await this.validateNAFDACLicense(licenseNumber);

      if (!isValid) {
        throw new Error('Invalid pharmacy license');
      }

      return { valid: true };
    } catch (error) {
      console.error('Pharmacy license verification failed:', error);
      throw error;
    }
  }

  /**
   * Complete pharmacy onboarding
   */
  async completePharmacyOnboarding(
    userId: string,
    data: PharmacyOnboarding
  ): Promise<{ success: boolean; approvalPending: boolean }> {
    try {
      // Verify license
      const licenseVerification = await this.verifyPharmacyLicense(
        data.pharmacyName,
        data.licenseNumber
      );
      if (!licenseVerification.valid) {
        throw new Error('License verification failed');
      }

      // Store pharmacy profile
      await this.storePharmacyOnboarding(userId, data);

      // Set approval pending
      await this.setPharmacyApprovalStatus(userId, 'pending');

      console.log('✅ Pharmacy onboarding submitted for approval');
      return { success: true, approvalPending: true };
    } catch (error) {
      console.error('Pharmacy onboarding failed:', error);
      throw error;
    }
  }

  // ==================== PERSONALIZATION ====================

  /**
   * Get personalization questions based on role
   */
  getPersonalizationQuestions(role: string): Array<{ id: string; question: string; type: string; options?: string[] }> {
    const questions: { [key: string]: any } = {
      patient: [
        {
          id: 'healthGoals',
          question: 'What are your main health goals?',
          type: 'multiselect',
          options: ['Weight Loss', 'Fitness', 'Mental Health', 'Disease Management', 'Prevention'],
        },
        {
          id: 'communicationPreference',
          question: 'How would you like us to communicate?',
          type: 'multiselect',
          options: ['Email', 'SMS', 'Push Notification', 'Phone Call'],
        },
        {
          id: 'preferredLanguage',
          question: 'Preferred language',
          type: 'select',
          options: ['English', 'Yoruba', 'Hausa', 'Igbo'],
        },
      ],
      doctor: [
        {
          id: 'consultationType',
          question: 'What types of consultation do you offer?',
          type: 'multiselect',
          options: ['In-Person', 'Video Call', 'Phone Call', 'Chat'],
        },
        {
          id: 'patientType',
          question: 'Who do you primarily treat?',
          type: 'multiselect',
          options: ['Adults', 'Children', 'Elderly', 'Pregnant Women'],
        },
      ],
      pharmacy: [
        {
          id: 'deliveryType',
          question: 'Do you offer delivery?',
          type: 'boolean',
        },
        {
          id: 'acceptInsurance',
          question: 'Do you accept insurance/NHIS?',
          type: 'boolean',
        },
      ],
    };

    return questions[role] || [];
  }

  /**
   * Save personalization preferences
   */
  async savePersonalizationPreferences(
    userId: string,
    role: string,
    preferences: any
  ): Promise<{ saved: boolean }> {
    try {
      await this.storeUserPreferences(userId, role, preferences);
      console.log('✅ Preferences saved');
      return { saved: true };
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  }

  // ==================== TUTORIAL & HELP ====================

  /**
   * Get role-specific tutorial steps
   */
  getRoleTutorial(role: string): Array<{ step: number; title: string; description: string; action?: string }> {
    const tutorials: { [key: string]: any } = {
      patient: [
        { step: 1, title: 'Find a Doctor', description: 'Search and book appointments with verified doctors' },
        { step: 2, title: 'Upload Records', description: 'Store your medical documents safely' },
        { step: 3, title: 'Manage Appointments', description: 'Track and manage all your appointments' },
        { step: 4, title: 'Prescription Refills', description: 'Request medication refills easily' },
      ],
      doctor: [
        { step: 1, title: 'Complete Profile', description: 'Add credentials and availability' },
        { step: 2, title: 'Manage Appointments', description: 'Accept/reschedule patient appointments' },
        { step: 3, title: 'Add Patients', description: 'Create clinical notes and prescriptions' },
        { step: 4, title: 'View Earnings', description: 'Track your consultations and payments' },
      ],
    };

    return tutorials[role] || [];
  }

  /**
   * Mark tutorial as completed
   */
  async completeTutorial(userId: string, tutorialStep: number): Promise<{ completed: boolean }> {
    try {
      await this.storeTutorialCompletion(userId, tutorialStep);
      return { completed: true };
    } catch (error) {
      console.error('Failed to mark tutorial complete:', error);
      throw error;
    }
  }

  // ==================== HELP & SUPPORT ====================

  /**
   * Get contextual help articles
   */
  getHelpArticles(category: string): Array<{ id: string; title: string; content: string; videoUrl?: string }> {
    // Would fetch from database
    return [
      {
        id: 'booking-appointment',
        title: 'How to Book an Appointment',
        content: 'Step-by-step guide to booking...',
      },
      {
        id: 'payment-issues',
        title: 'Payment Issues',
        content: 'Troubleshooting payment problems...',
      },
    ];
  }

  /**
   * Request support/report issue
   */
  async requestSupport(userId: string, issue: string, category: string): Promise<{ ticketId: string }> {
    try {
      const ticketId = this.generateTicketId();
      await this.createSupportTicket(userId, ticketId, issue, category);

      console.log(`✅ Support ticket created: ${ticketId}`);
      return { ticketId };
    } catch (error) {
      console.error('Failed to create support ticket:', error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private async storePatientOnboarding(userId: string, data: PatientOnboarding): Promise<void> {
    // Database call
  }

  private async storeDoctorOnboarding(userId: string, data: DoctorOnboarding): Promise<void> {
    // Database call
  }

  private async storePharmacyOnboarding(userId: string, data: PharmacyOnboarding): Promise<void> {
    // Database call
  }

  private async markUserOnboarded(userId: string, role: string): Promise<void> {
    // Database call
  }

  private async validateMDCNLicense(licenseNumber: string): Promise<boolean> {
    // External API call
    return true;
  }

  private async fetchLicenseDetails(licenseNumber: string): Promise<any> {
    // External API call
    return {};
  }

  private async validateNAFDACLicense(licenseNumber: string): Promise<boolean> {
    // External API call
    return true;
  }

  private async setDoctorApprovalStatus(userId: string, status: string): Promise<void> {
    // Database call
  }

  private async setPharmacyApprovalStatus(userId: string, status: string): Promise<void> {
    // Database call
  }

  private async getDoctorProfile(userId: string): Promise<any> {
    // Database call
    return {};
  }

  private async storeUserPreferences(userId: string, role: string, preferences: any): Promise<void> {
    // Database call
  }

  private async storeTutorialCompletion(userId: string, step: number): Promise<void> {
    // Database call
  }

  private async createSupportTicket(userId: string, ticketId: string, issue: string, category: string): Promise<void> {
    // Database call
  }

  private generateTicketId(): string {
    return `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default OnboardingService.getInstance();
