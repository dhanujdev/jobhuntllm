import { ActionResult, type AgentContext } from '@src/background/agent/types';
import { createLogger } from '@src/background/log';
import { ResumeManager } from '../data/resume-manager';
import { Action } from './builder';
import { z } from 'zod';

const logger = createLogger('BatchActions');

/**
 * Batch job application schema - processes multiple steps at once
 */
export const batchJobApplicationSchema = {
  name: 'batch_job_application',
  description:
    'Complete entire job application in one fast execution, handling multiple form fields and steps simultaneously.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    mode: z.enum(['aggressive', 'conservative', 'smart']).default('smart').describe('execution speed mode'),
    platform: z
      .enum(['linkedin', 'indeed', 'glassdoor', 'workday', 'greenhouse', 'other'])
      .describe('job platform detected'),
    auto_submit: z.boolean().default(false).describe('automatically submit after filling'),
    skip_ai_questions: z.boolean().default(true).describe('use templates for standard questions'),
    max_steps: z.number().default(50).describe('maximum steps to execute in batch'),
  }),
};

/**
 * Fast form filler - fills multiple fields without individual AI decisions
 */
export const fastFormFillSchema = {
  name: 'fast_form_fill',
  description: 'Rapidly fill all detected form fields using resume data and standard patterns without AI delays.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    field_types: z.array(z.string()).optional().describe('specific field types to fill'),
    use_templates: z.boolean().default(true).describe('use template responses for questions'),
    timeout_seconds: z.number().default(30).describe('maximum time to spend on form filling'),
  }),
};

/**
 * Batch Job Application Action - Speed Optimized
 */
export function createBatchJobApplicationAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      mode?: 'aggressive' | 'conservative' | 'smart';
      platform?: 'linkedin' | 'indeed' | 'glassdoor' | 'workday' | 'greenhouse' | 'other';
      auto_submit?: boolean;
      skip_ai_questions?: boolean;
      max_steps?: number;
    }) => {
      logger.info('Starting batch job application', { input });

      try {
        const startTime = Date.now();
        const page = await context.browserContext.getCurrentPage();
        const autoFillData = await ResumeManager.getAutoFillData();

        if (!autoFillData) {
          return {
            success: false,
            message: 'No resume data found. Please set up your resume first.',
            screenshot: await page.takeScreenshot(),
          };
        }

        const results = {
          fieldsProcessed: 0,
          buttonsClicked: 0,
          questionsAnswered: 0,
          stepsCompleted: 0,
          errors: [] as string[],
        };

        // Phase 1: Rapid Form Detection and Filling
        await rapidFormFill(page, autoFillData, input, results);

        // Phase 2: Handle Application Flow (Next buttons, navigation)
        await handleApplicationFlow(page, input, results);

        // Phase 3: Answer Questions with Templates
        if (input.skip_ai_questions) {
          await answerQuestionsWithTemplates(page, autoFillData, results);
        }

        // Phase 4: Auto-submit if requested
        if (input.auto_submit) {
          await attemptSubmission(page, results);
        }

        const totalTime = Date.now() - startTime;

        return {
          success: results.errors.length === 0,
          message: `Batch application completed in ${totalTime}ms: ${results.fieldsProcessed} fields, ${results.buttonsClicked} buttons, ${results.questionsAnswered} questions`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            ...results,
            executionTime: totalTime,
            mode: input.mode,
            efficiency: `${Math.round(results.fieldsProcessed / (totalTime / 1000))} fields/second`,
          },
        };
      } catch (error) {
        logger.error('Batch application failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Batch application failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    batchJobApplicationSchema,
  );
}

/**
 * Fast Form Fill Action - No AI delays
 */
export function createFastFormFillAction(context: AgentContext): Action {
  return new Action(
    async (input: { intent?: string; field_types?: string[]; use_templates?: boolean; timeout_seconds?: number }) => {
      logger.info('Starting fast form fill', { input });

      try {
        const startTime = Date.now();
        const timeout = (input.timeout_seconds || 30) * 1000;
        const page = await context.browserContext.getCurrentPage();
        const autoFillData = await ResumeManager.getAutoFillData();

        if (!autoFillData) {
          return {
            success: false,
            message: 'No resume data available for fast fill',
            screenshot: await page.takeScreenshot(),
          };
        }

        let fieldsProcessed = 0;
        const errors: string[] = [];

        // Get all form elements at once
        const state = await page.getState();
        if (!state?.selectorMap) {
          return {
            success: false,
            message: 'Cannot access page elements',
            screenshot: await page.takeScreenshot(),
          };
        }

        // Batch process all form fields
        const formElements = Array.from(state.selectorMap.entries()).filter(([index, element]) => {
          const tagName = element.tagName?.toLowerCase();
          return ['input', 'textarea', 'select'].includes(tagName || '') && element.isInteractable();
        });

        // Process fields in parallel where possible
        for (const [index, element] of formElements) {
          if (Date.now() - startTime > timeout) break;

          try {
            const filled = await fillFieldFast(page, index, element, autoFillData, input.use_templates);
            if (filled) fieldsProcessed++;
          } catch (error) {
            errors.push(`Field ${index}: ${error.message}`);
          }
        }

        const totalTime = Date.now() - startTime;

        return {
          success: errors.length < fieldsProcessed / 2, // Success if <50% errors
          message: `Fast fill completed: ${fieldsProcessed} fields in ${totalTime}ms`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            fieldsProcessed,
            errors,
            speed: `${Math.round(fieldsProcessed / (totalTime / 1000))} fields/second`,
            efficiency: `${Math.round((fieldsProcessed / (fieldsProcessed + errors.length)) * 100)}%`,
          },
        };
      } catch (error) {
        logger.error('Fast form fill failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Fast form fill failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    fastFormFillSchema,
  );
}

// Helper methods for batch processing
async function rapidFormFill(page: any, autoFillData: any, input: any, results: any): Promise<void> {
  const state = await page.getState();
  if (!state?.selectorMap) return;

  const fieldMappings = {
    // Personal info
    firstName: autoFillData.first_name,
    first_name: autoFillData.first_name,
    fname: autoFillData.first_name,
    lastName: autoFillData.last_name,
    last_name: autoFillData.last_name,
    lname: autoFillData.last_name,
    email: autoFillData.email,
    phone: autoFillData.phone,
    mobile: autoFillData.phone,

    // Professional info
    experience: autoFillData.experience_years,
    years: autoFillData.experience_years,
    title: autoFillData.current_title,
    company: autoFillData.current_company,

    // Standard answers
    degree: 'Yes',
    bachelor: 'Yes',
    authorized: 'Yes',
    sponsorship: 'No',
    visa: 'No',
    relocate: autoFillData.willing_to_relocate || 'Yes',
    remote: autoFillData.remote_work || 'Yes',
    commute: 'Yes',
    onsite: 'Yes',
  };

  // Batch fill all detected fields
  for (const [index, element] of state.selectorMap.entries()) {
    const tagName = element.tagName?.toLowerCase();
    if (!['input', 'textarea', 'select'].includes(tagName || '')) continue;
    if (!element.isInteractable()) continue;

    try {
      const fieldValue = detectFieldValue(element, fieldMappings);
      if (fieldValue) {
        await page.inputTextElementNode(false, element, fieldValue);
        results.fieldsProcessed++;
      }
    } catch (error) {
      results.errors.push(`Field ${index}: ${error.message}`);
    }
  }
}

async function handleApplicationFlow(page: any, input: any, results: any): Promise<void> {
  // Look for and click navigation buttons
  const buttonTexts = ['next', 'continue', 'proceed', 'submit'];
  const state = await page.getState();

  for (const [index, element] of state.selectorMap.entries()) {
    if (element.tagName?.toLowerCase() === 'button') {
      const buttonText = element.textContent?.toLowerCase() || '';
      if (buttonTexts.some(text => buttonText.includes(text))) {
        try {
          await page.clickElementNode(false, element);
          results.buttonsClicked++;
          await page.waitForPageLoadState(2000); // Wait for page transition
          break; // Only click one navigation button at a time
        } catch (error) {
          results.errors.push(`Button ${index}: ${error.message}`);
        }
      }
    }
  }
}

async function answerQuestionsWithTemplates(page: any, autoFillData: any, results: any): Promise<void> {
  const templateAnswers = {
    'why interested': `I am excited about this opportunity because it aligns with my ${autoFillData.experience_years} of experience and career goals.`,
    'why qualify': `My background in ${autoFillData.technical_skills} and ${autoFillData.experience_years} of professional experience make me well-suited for this role.`,
    salary: autoFillData.salary_expectation || 'Competitive',
    'start date': autoFillData.start_date || 'Immediate',
    'notice period': '2 weeks',
    availability: 'Immediately available',
  };

  const state = await page.getState();

  for (const [index, element] of state.selectorMap.entries()) {
    if (element.tagName?.toLowerCase() === 'textarea') {
      const placeholder = element.attributes?.placeholder?.toLowerCase() || '';
      const label = element.textContent?.toLowerCase() || '';

      for (const [question, answer] of Object.entries(templateAnswers)) {
        if (placeholder.includes(question) || label.includes(question)) {
          try {
            await page.inputTextElementNode(false, element, answer);
            results.questionsAnswered++;
            break;
          } catch (error) {
            results.errors.push(`Question ${index}: ${error.message}`);
          }
        }
      }
    }
  }
}

async function attemptSubmission(page: any, results: any): Promise<void> {
  const submitTexts = ['submit', 'apply', 'send application'];
  const state = await page.getState();

  for (const [index, element] of state.selectorMap.entries()) {
    if (element.tagName?.toLowerCase() === 'button') {
      const buttonText = element.textContent?.toLowerCase() || '';
      if (submitTexts.some(text => buttonText.includes(text))) {
        try {
          await page.clickElementNode(false, element);
          results.stepsCompleted++;
          return;
        } catch (error) {
          results.errors.push(`Submit ${index}: ${error.message}`);
        }
      }
    }
  }
}

function detectFieldValue(element: any, fieldMappings: Record<string, string>): string | null {
  const identifiers = [
    element.attributes?.name,
    element.attributes?.id,
    element.attributes?.placeholder,
    element.textContent,
  ]
    .filter(Boolean)
    .map(s => s.toLowerCase());

  for (const [key, value] of Object.entries(fieldMappings)) {
    if (identifiers.some(id => id.includes(key))) {
      return value;
    }
  }

  return null;
}

async function fillFieldFast(
  page: any,
  index: number,
  element: any,
  autoFillData: any,
  useTemplates: boolean,
): Promise<boolean> {
  const fieldValue = detectFieldValue(element, {
    firstName: autoFillData.first_name,
    lastName: autoFillData.last_name,
    email: autoFillData.email,
    phone: autoFillData.phone,
    experience: autoFillData.experience_years,
    degree: 'Yes',
    authorized: 'Yes',
    sponsorship: 'No',
  });

  if (fieldValue) {
    await page.inputTextElementNode(false, element, fieldValue);
    return true;
  }

  return false;
}

/**
 * Export batch actions for integration
 */
export function createBatchActions(context: AgentContext): Action[] {
  return [createBatchJobApplicationAction(context), createFastFormFillAction(context)];
}
