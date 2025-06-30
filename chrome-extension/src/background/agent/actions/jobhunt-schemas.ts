import { z } from 'zod';
import type { ActionSchema } from './schemas';

/**
 * Job application specific action schemas
 */

export const autoFillJobApplicationSchema: ActionSchema = {
  name: 'auto_fill_job_application',
  description:
    'Automatically fill job application form using stored resume data. Detects common fields and populates them efficiently.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    application_type: z
      .enum(['quick_apply', 'multi_step', 'ats_system', 'company_portal'])
      .optional()
      .describe('type of application detected'),
    skip_fields: z.array(z.string()).optional().describe('field names to skip during auto-fill'),
    custom_field_name: z.string().optional().describe('name of custom field to fill'),
    custom_field_value: z.string().optional().describe('value for custom field'),
  }),
};

export const uploadResumeSchema: ActionSchema = {
  name: 'upload_resume',
  description: 'Upload resume/CV file to job application. Handles file selection and upload process.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    file_input_index: z.number().int().describe('index of the file input element'),
    file_type: z
      .enum(['resume', 'cover_letter', 'portfolio'])
      .default('resume')
      .describe('type of file being uploaded'),
    xpath: z.string().nullable().optional().describe('xpath of the file input element'),
  }),
};

export const generateCoverLetterSchema: ActionSchema = {
  name: 'generate_cover_letter',
  description: 'Generate customized cover letter based on job description and company information.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    job_title: z.string().describe('job title from the posting'),
    company_name: z.string().describe('company name'),
    job_description: z.string().describe('job description text for customization'),
    target_field_index: z.number().int().optional().describe('index of text area to fill with cover letter'),
  }),
};

export const detectJobApplicationFormSchema: ActionSchema = {
  name: 'detect_job_application_form',
  description: 'Analyze current page to detect job application form structure and required fields.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    save_pattern: z.boolean().default(true).describe('whether to save the detected pattern for future use'),
  }),
};

export const fillSalaryFieldSchema: ActionSchema = {
  name: 'fill_salary_field',
  description: 'Handle salary expectation fields with smart defaults based on resume data and job level.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    field_index: z.number().int().describe('index of the salary field'),
    field_type: z.enum(['minimum', 'maximum', 'expected', 'current']).describe('type of salary field'),
    use_negotiable: z.boolean().default(true).describe('whether to indicate salary is negotiable'),
    xpath: z.string().nullable().optional().describe('xpath of the salary field'),
  }),
};

export const handleJobQuestionsSchema: ActionSchema = {
  name: 'handle_job_questions',
  description: 'Answer common job application questions using templates and AI customization.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    question_type: z
      .enum(['why_interested', 'why_qualified', 'career_goals', 'availability', 'custom'])
      .describe('type of question detected'),
    question_text: z.string().describe('full text of the question'),
    field_index: z.number().int().describe('index of the text field to fill'),
    max_length: z.number().int().optional().describe('character limit if detected'),
    xpath: z.string().nullable().optional().describe('xpath of the text field'),
  }),
};

export const trackApplicationSchema: ActionSchema = {
  name: 'track_application',
  description: 'Save application details for tracking and avoiding duplicates.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    job_title: z.string().describe('job title'),
    company_name: z.string().describe('company name'),
    platform: z.string().describe('job platform (LinkedIn, Indeed, etc.)'),
    application_id: z.string().optional().describe('application reference ID if available'),
    application_url: z.string().optional().describe('URL of the job posting'),
    notes: z.string().optional().describe('additional notes about the application'),
  }),
};

export const checkApplicationStatusSchema: ActionSchema = {
  name: 'check_application_status',
  description: 'Verify if application was submitted successfully and capture confirmation details.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    expected_confirmation: z
      .enum(['page', 'modal', 'email', 'redirect'])
      .optional()
      .describe('expected type of confirmation'),
  }),
};

export const skipDuplicateApplicationSchema: ActionSchema = {
  name: 'skip_duplicate_application',
  description: 'Check if user has already applied to this position and skip if duplicate.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    job_title: z.string().describe('job title to check'),
    company_name: z.string().describe('company name to check'),
    force_apply: z.boolean().default(false).describe('apply even if duplicate detected'),
  }),
};

export const optimizeApplicationFlowSchema: ActionSchema = {
  name: 'optimize_application_flow',
  description: 'Analyze and save efficient application flow patterns for future use.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    platform: z.string().describe('job platform name'),
    flow_type: z.string().describe('type of application flow detected'),
    time_taken: z.number().optional().describe('time taken in seconds'),
    success: z.boolean().describe('whether the application was successful'),
    bottlenecks: z.array(z.string()).optional().describe('identified bottlenecks in the process'),
  }),
};

export const handleLinkedInEasyApplySchema: ActionSchema = {
  name: 'handle_linkedin_easy_apply',
  description: 'Specialized handler for LinkedIn Easy Apply workflow with multi-step navigation.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    step: z
      .enum(['initial', 'contact_info', 'resume', 'questions', 'review', 'submit'])
      .describe('current step in Easy Apply process'),
    auto_advance: z.boolean().default(true).describe('automatically advance to next step when possible'),
  }),
};

export const handleIndeedApplySchema: ActionSchema = {
  name: 'handle_indeed_apply',
  description: 'Specialized handler for Indeed application workflows including employer redirects.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    application_method: z
      .enum(['indeed_apply', 'employer_redirect', 'external_link'])
      .describe('method of application on Indeed'),
    handle_redirect: z.boolean().default(true).describe('follow employer redirects automatically'),
  }),
};

export const handleATSSystemSchema: ActionSchema = {
  name: 'handle_ats_system',
  description: 'Handle complex ATS (Applicant Tracking System) forms like Workday, Greenhouse, Lever.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    ats_type: z
      .enum(['workday', 'greenhouse', 'lever', 'bamboohr', 'icims', 'jobvite', 'unknown'])
      .describe('detected ATS system'),
    section: z.string().optional().describe('current section of the ATS form'),
    save_progress: z.boolean().default(true).describe('save progress for multi-session applications'),
  }),
};

export const saveWorkflowSchema: ActionSchema = {
  name: 'save_workflow',
  description: 'Save current execution as a reusable workflow pattern for future applications.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    platform: z.string().describe('job platform (linkedin, indeed, etc.)'),
    application_type: z.string().describe('type of application (easy_apply, ats_system, etc.)'),
    workflow_name: z.string().optional().describe('custom name for the workflow'),
    include_ai_steps: z.boolean().default(false).describe('whether to include AI-required steps'),
  }),
};

export const executeWorkflowSchema: ActionSchema = {
  name: 'execute_workflow',
  description: 'Execute a saved workflow pattern with minimal AI usage for efficient job applications.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    workflow_id: z.string().describe('ID of the workflow to execute'),
    use_ai: z.boolean().default(false).describe('whether to use AI for complex steps'),
    custom_data: z.string().optional().describe('custom data to inject (company name, etc.)'),
  }),
};

/**
 * All job hunt specific action schemas
 */
export const jobHuntActionSchemas = [
  autoFillJobApplicationSchema,
  uploadResumeSchema,
  generateCoverLetterSchema,
  detectJobApplicationFormSchema,
  fillSalaryFieldSchema,
  handleJobQuestionsSchema,
  trackApplicationSchema,
  checkApplicationStatusSchema,
  skipDuplicateApplicationSchema,
  optimizeApplicationFlowSchema,
  handleLinkedInEasyApplySchema,
  handleIndeedApplySchema,
  handleATSSystemSchema,
  saveWorkflowSchema,
  executeWorkflowSchema,
];
