import { z } from 'zod';

/**
 * Resume data schema for structured storage and auto-filling
 */
export const ResumeDataSchema = z.object({
  personalInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    address: z.object({
      street: z.string().optional(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string().default('United States'),
    }),
    linkedIn: z.string().url().optional(),
    portfolio: z.string().url().optional(),
    github: z.string().url().optional(),
  }),

  professional: z.object({
    currentTitle: z.string(),
    currentCompany: z.string().optional(),
    totalExperience: z.string(), // e.g., "5 years", "2-3 years"
    summary: z.string(), // Professional summary/objective

    workExperience: z.array(
      z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        startDate: z.string(), // Format: "MM/YYYY"
        endDate: z.string().optional(), // "Present" for current role
        description: z.string(),
        keyAchievements: z.array(z.string()).optional(),
      }),
    ),

    education: z.array(
      z.object({
        degree: z.string(),
        school: z.string(),
        location: z.string(),
        graduationDate: z.string(), // Format: "MM/YYYY"
        gpa: z.string().optional(),
        relevantCoursework: z.array(z.string()).optional(),
      }),
    ),

    skills: z.object({
      technical: z.array(z.string()),
      programming: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      certifications: z.array(z.string()).optional(),
    }),

    salaryExpectations: z
      .object({
        minimum: z.number().optional(),
        maximum: z.number().optional(),
        negotiable: z.boolean().default(true),
      })
      .optional(),

    availability: z.object({
      startDate: z.string(), // "Immediate", "2 weeks", specific date
      remote: z.boolean().default(true),
      relocation: z.boolean().default(false),
      travel: z.string().default('0-25%'), // Travel willingness
    }),
  }),

  preferences: z.object({
    jobTypes: z.array(z.string()), // ["Full-time", "Contract", "Remote"]
    industries: z.array(z.string()),
    locations: z.array(z.string()),
    companySize: z.array(z.string()).optional(), // ["Startup", "Mid-size", "Enterprise"]
  }),

  documents: z.object({
    resumeFile: z.string().optional(), // Base64 or file path
    coverLetterTemplate: z.string(),
    portfolioFiles: z.array(z.string()).optional(),
  }),

  applicationHistory: z
    .array(
      z.object({
        jobTitle: z.string(),
        company: z.string(),
        platform: z.string(),
        appliedDate: z.string(),
        status: z.enum(['applied', 'rejected', 'interview', 'offer']),
        applicationId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

export type ResumeData = z.infer<typeof ResumeDataSchema>;

/**
 * Resume Manager for handling user resume data and auto-fill functionality
 */
export class ResumeManager {
  private static readonly STORAGE_KEY = 'jobhuntllm_resume_data';

  /**
   * Save resume data to Chrome storage
   */
  static async saveResumeData(data: ResumeData): Promise<void> {
    try {
      const validatedData = ResumeDataSchema.parse(data);
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: validatedData,
      });
    } catch (error) {
      console.error('Error saving resume data:', error);
      throw new Error('Invalid resume data format');
    }
  }

  /**
   * Load resume data from Chrome storage
   */
  static async loadResumeData(): Promise<ResumeData | null> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      if (!result[this.STORAGE_KEY]) {
        return null;
      }
      return ResumeDataSchema.parse(result[this.STORAGE_KEY]);
    } catch (error) {
      console.error('Error loading resume data:', error);
      return null;
    }
  }

  /**
   * Get auto-fill data for common job application fields
   */
  static async getAutoFillData(): Promise<Record<string, string> | null> {
    const resumeData = await this.loadResumeData();
    if (!resumeData) return null;

    const { personalInfo, professional } = resumeData;

    return {
      // Personal Information
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      email: personalInfo.email,
      phone: personalInfo.phone,
      address: personalInfo.address.street || '',
      city: personalInfo.address.city,
      state: personalInfo.address.state,
      zip_code: personalInfo.address.zipCode,
      country: personalInfo.address.country,
      linkedin: personalInfo.linkedIn || '',
      portfolio: personalInfo.portfolio || '',
      github: personalInfo.github || '',

      // Professional Information
      current_title: professional.currentTitle,
      current_company: professional.currentCompany || '',
      experience_years: professional.totalExperience,
      summary: professional.summary,

      // Most recent work experience
      previous_title: professional.workExperience[0]?.title || '',
      previous_company: professional.workExperience[0]?.company || '',
      previous_description: professional.workExperience[0]?.description || '',

      // Education
      degree: professional.education[0]?.degree || '',
      school: professional.education[0]?.school || '',
      graduation_date: professional.education[0]?.graduationDate || '',

      // Skills
      technical_skills: professional.skills.technical.join(', '),
      programming_languages: professional.skills.programming?.join(', ') || '',

      // Preferences
      salary_min: professional.salaryExpectations?.minimum?.toString() || '',
      salary_max: professional.salaryExpectations?.maximum?.toString() || '',
      start_date: professional.availability.startDate,
      remote_work: professional.availability.remote ? 'Yes' : 'No',
      willing_to_relocate: professional.availability.relocation ? 'Yes' : 'No',
      travel_percentage: professional.availability.travel,

      // Cover letter template
      cover_letter: resumeData.documents.coverLetterTemplate,
    };
  }

  /**
   * Generate customized cover letter based on job description
   */
  static async generateCustomCoverLetter(jobDescription: string, companyName: string): Promise<string> {
    const resumeData = await this.loadResumeData();
    if (!resumeData) {
      throw new Error('No resume data found');
    }

    const template = resumeData.documents.coverLetterTemplate;
    const { personalInfo, professional } = resumeData;

    // Replace template variables
    return template
      .replace(/\{firstName\}/g, personalInfo.firstName)
      .replace(/\{lastName\}/g, personalInfo.lastName)
      .replace(/\{companyName\}/g, companyName)
      .replace(/\{currentTitle\}/g, professional.currentTitle)
      .replace(/\{experience\}/g, professional.totalExperience)
      .replace(/\{skills\}/g, professional.skills.technical.slice(0, 3).join(', '))
      .replace(/\{summary\}/g, professional.summary);
  }

  /**
   * Track job application in history
   */
  static async trackApplication(application: {
    jobTitle: string;
    company: string;
    platform: string;
    applicationId?: string;
    notes?: string;
  }): Promise<void> {
    const resumeData = await this.loadResumeData();
    if (!resumeData) return;

    const newApplication = {
      ...application,
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'applied' as const,
      applicationId: application.applicationId,
      notes: application.notes,
    };

    resumeData.applicationHistory.push(newApplication);
    await this.saveResumeData(resumeData);
  }

  /**
   * Check if already applied to a position
   */
  static async hasAppliedTo(jobTitle: string, company: string): Promise<boolean> {
    const resumeData = await this.loadResumeData();
    if (!resumeData) return false;

    return resumeData.applicationHistory.some(
      app =>
        app.jobTitle.toLowerCase().includes(jobTitle.toLowerCase()) &&
        app.company.toLowerCase().includes(company.toLowerCase()),
    );
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(): Promise<{
    total: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: Record<string, number>;
    byPlatform: Record<string, number>;
  }> {
    const resumeData = await this.loadResumeData();
    if (!resumeData) {
      return { total: 0, thisWeek: 0, thisMonth: 0, byStatus: {}, byPlatform: {} };
    }

    const applications = resumeData.applicationHistory;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: applications.length,
      thisWeek: applications.filter(app => new Date(app.appliedDate) >= weekAgo).length,
      thisMonth: applications.filter(app => new Date(app.appliedDate) >= monthAgo).length,
      byStatus: applications.reduce(
        (acc, app) => {
          acc[app.status] = (acc[app.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byPlatform: applications.reduce(
        (acc, app) => {
          acc[app.platform] = (acc[app.platform] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}

/**
 * Default resume template for new users
 */
export const DEFAULT_RESUME_TEMPLATE: Partial<ResumeData> = {
  personalInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States',
    },
  },
  professional: {
    currentTitle: '',
    totalExperience: '',
    summary: '',
    workExperience: [],
    education: [],
    skills: {
      technical: [],
      programming: [],
      languages: [],
      certifications: [],
    },
    availability: {
      startDate: 'Immediate',
      remote: true,
      relocation: false,
      travel: '0-25%',
    },
  },
  preferences: {
    jobTypes: ['Full-time'],
    industries: [],
    locations: [],
  },
  documents: {
    coverLetterTemplate: `Dear Hiring Manager,

I am writing to express my interest in the {currentTitle} position at {companyName}. With {experience} of experience in the field, I am confident that my skills in {skills} make me a strong candidate for this role.

{summary}

I am excited about the opportunity to contribute to {companyName} and would welcome the chance to discuss how my background and enthusiasm can benefit your team.

Thank you for your consideration.

Best regards,
{firstName} {lastName}`,
  },
};
