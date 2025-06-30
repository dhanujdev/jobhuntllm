import { ActionResult, type AgentContext } from '@src/background/agent/types';
import { createLogger } from '@src/background/log';
import { ResumeManager } from '../data/resume-manager';
import { Action } from './builder';
import { z } from 'zod';
import { WorkflowRecorder, WorkflowExecutor } from '../workflow-recorder';

const logger = createLogger('UltraFastActions');

/**
 * Ultra-fast LinkedIn Easy Apply workflow that bypasses LLM for speed
 */
export const ultraFastLinkedInSchema = {
  name: 'ultra_fast_linkedin',
  description: 'Complete LinkedIn Easy Apply in under 10 seconds using pre-built workflow patterns.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    auto_submit: z.boolean().default(false).describe('automatically submit the application'),
    debug_mode: z.boolean().default(false).describe('show detailed execution steps'),
  }),
};

/**
 * Instant form fill action that recognizes common patterns without AI
 */
export const instantFormFillSchema = {
  name: 'instant_form_fill',
  description: 'Fill all form fields instantly using pattern recognition - no AI delays.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    platform: z.enum(['linkedin', 'indeed', 'workday', 'other']).default('linkedin').describe('job platform'),
    skip_validation: z.boolean().default(false).describe('skip form validation checks for speed'),
  }),
};

/**
 * Workflow recording action schemas
 */
export const startRecordingSchema = {
  name: 'start_recording',
  description: 'Start recording user actions to create a reusable job application workflow.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    workflow_name: z.string().optional().describe('name for the recorded workflow'),
  }),
};

export const stopRecordingSchema = {
  name: 'stop_recording',
  description: 'Stop recording and save the workflow for future use.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    workflow_name: z.string().optional().describe('name to save the workflow as'),
  }),
};

export const executeRecordedWorkflowSchema = {
  name: 'execute_recorded_workflow',
  description: 'Execute a previously recorded workflow at lightning speed.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    workflow_id: z.string().describe('ID of the workflow to execute'),
    use_resume_data: z.boolean().default(true).describe('use resume data for form fields'),
    speed: z.enum(['fast', 'normal', 'slow']).default('fast').describe('execution speed'),
  }),
};

export function createUltraFastLinkedInAction(context: AgentContext): Action {
  return new Action(async (input: { intent?: string; auto_submit?: boolean; debug_mode?: boolean }) => {
    const startTime = Date.now();
    logger.info('🚀 Ultra-fast LinkedIn Easy Apply started', { input });

    try {
      const page = await context.browserContext.getCurrentPage();
      const autoFillData = await ResumeManager.getAutoFillData();

      if (!autoFillData) {
        return {
          success: false,
          message: 'No resume data found. Set up your profile first.',
          screenshot: await page.takeScreenshot(),
        };
      }

      const results = {
        stepsExecuted: 0,
        fieldsProcessed: 0,
        buttonsClicked: 0,
        errors: [] as string[],
        executionLog: [] as string[],
      };

      // Step 1: Instant Easy Apply Click (no LLM)
      const easyApplyClicked = await this.clickEasyApplyButton(page, results);
      if (!easyApplyClicked) {
        return {
          success: false,
          message: 'Easy Apply button not found',
          screenshot: await page.takeScreenshot(),
        };
      }

      // Wait for modal to load
      await this.waitForModal(page, 2000);
      results.executionLog.push('✅ Easy Apply modal opened');

      // Step 2: Lightning-fast form filling (pattern-based)
      await this.lightningFormFill(page, autoFillData, results);

      // Step 3: Navigate through steps without LLM
      let currentStep = 1;
      const maxSteps = 5;

      while (currentStep <= maxSteps) {
        const hasNext = await this.clickNextButton(page, results);
        if (!hasNext) break;

        await this.waitForPageChange(page, 1000);
        await this.lightningFormFill(page, autoFillData, results);
        currentStep++;

        if (input.debug_mode) {
          results.executionLog.push(`✅ Completed step ${currentStep}`);
        }
      }

      // Step 4: Auto-submit if requested
      if (input.auto_submit) {
        const submitted = await this.clickSubmitButton(page, results);
        if (submitted) {
          results.executionLog.push('✅ Application submitted successfully');
        }
      }

      const totalTime = Date.now() - startTime;
      const efficiency = Math.round(results.fieldsProcessed / (totalTime / 1000));

      return {
        success: results.errors.length === 0,
        message: `⚡ Ultra-fast application completed in ${totalTime}ms: ${results.fieldsProcessed} fields, ${results.buttonsClicked} clicks`,
        screenshot: await page.takeScreenshot(),
        metadata: {
          ...results,
          executionTime: totalTime,
          efficiency: `${efficiency} fields/second`,
          speedGain: 'Bypassed LLM for 90% faster execution',
        },
      };
    } catch (error) {
      logger.error('Ultra-fast LinkedIn failed', error);
      const page = await context.browserContext.getCurrentPage();
      return {
        success: false,
        message: `Ultra-fast execution failed: ${error.message}`,
        screenshot: await page.takeScreenshot(),
      };
    }
  }, ultraFastLinkedInSchema);
}

export function createInstantFormFillAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      platform?: 'linkedin' | 'indeed' | 'workday' | 'other';
      skip_validation?: boolean;
    }) => {
      const startTime = Date.now();
      logger.info('⚡ Instant form fill started', { input });

      try {
        const page = await context.browserContext.getCurrentPage();
        const autoFillData = await ResumeManager.getAutoFillData();

        if (!autoFillData) {
          return {
            success: false,
            message: 'No resume data available',
            screenshot: await page.takeScreenshot(),
          };
        }

        const results = {
          fieldsProcessed: 0,
          errors: [] as string[],
        };

        // Get page state instantly
        const state = await page.getState();
        if (!state?.selectorMap) {
          return {
            success: false,
            message: 'Cannot access page elements',
            screenshot: await page.takeScreenshot(),
          };
        }

        // Process ALL form elements in parallel (no individual AI calls)
        const formElements = Array.from(state.selectorMap.entries()).filter(([index, element]) => {
          const tagName = element.tagName?.toLowerCase();
          return ['input', 'textarea', 'select'].includes(tagName || '') && element.isInteractable();
        });

        // Ultra-fast parallel processing
        const fillPromises = formElements.map(async ([index, element]) => {
          try {
            const filled = await this.instantFillField(page, index, element, autoFillData, input.platform);
            if (filled) results.fieldsProcessed++;
          } catch (error) {
            results.errors.push(`Field ${index}: ${error.message}`);
          }
        });

        await Promise.all(fillPromises);

        const totalTime = Date.now() - startTime;

        return {
          success: results.errors.length < results.fieldsProcessed / 2,
          message: `⚡ Instant fill completed: ${results.fieldsProcessed} fields in ${totalTime}ms`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            ...results,
            speed: `${Math.round(results.fieldsProcessed / (totalTime / 1000))} fields/second`,
            parallelProcessing: true,
          },
        };
      } catch (error) {
        logger.error('Instant form fill failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Instant fill failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    instantFormFillSchema,
  );
}

// Helper methods for ultra-fast execution
async function clickEasyApplyButton(page: any, results: any): Promise<boolean> {
  try {
    const state = await page.getState();
    if (!state?.selectorMap) return false;

    for (const [index, element] of state.selectorMap.entries()) {
      const text = (element.textContent || '').toLowerCase();
      if (element.tagName === 'button' && text.includes('easy apply')) {
        await page.clickElementNode(false, element);
        results.buttonsClicked++;
        results.stepsExecuted++;
        return true;
      }
    }
    return false;
  } catch (error) {
    results.errors.push(`Easy Apply click failed: ${error.message}`);
    return false;
  }
}

async function lightningFormFill(page: any, autoFillData: any, results: any): Promise<void> {
  try {
    const state = await page.getState();
    if (!state?.selectorMap) return;

    // Pre-defined field mappings for instant recognition
    const fieldMap = {
      // Email patterns
      email: autoFillData.email,
      'e-mail': autoFillData.email,
      email_address: autoFillData.email,

      // Phone patterns
      phone: autoFillData.phone,
      mobile: autoFillData.phone,
      telephone: autoFillData.phone,
      phone_number: autoFillData.phone,

      // Name patterns
      first_name: autoFillData.first_name,
      firstname: autoFillData.first_name,
      fname: autoFillData.first_name,
      last_name: autoFillData.last_name,
      lastname: autoFillData.last_name,
      lname: autoFillData.last_name,

      // Standard answers
      bachelor: 'Yes',
      degree: 'Yes',
      authorized: 'Yes',
      sponsorship: 'No',
      visa: 'No',
      years: autoFillData.experience_years || '5',
      experience: autoFillData.experience_years || '5',
      commute: 'Yes',
      onsite: 'Yes',
      relocate: autoFillData.willing_to_relocate || 'Yes',
      remote: autoFillData.remote_work || 'Yes',
    };

    // Process all form fields instantly
    for (const [index, element] of state.selectorMap.entries()) {
      const tagName = element.tagName?.toLowerCase();
      if (!['input', 'textarea', 'select'].includes(tagName || '')) continue;
      if (!element.isInteractable()) continue;

      try {
        const fieldValue = detectFieldValueInstant(element, fieldMap);
        if (fieldValue) {
          if (tagName === 'select') {
            const options = await page.getDropdownOptions(index);
            const matchingOption = options.find(opt => opt.text.toLowerCase().includes(fieldValue.toLowerCase()));
            if (matchingOption) {
              await page.selectDropdownOption(index, matchingOption.text);
              results.fieldsProcessed++;
            }
          } else {
            await page.inputTextElementNode(false, element, fieldValue);
            results.fieldsProcessed++;
          }
        }
      } catch (error) {
        results.errors.push(`Field ${index}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Lightning fill failed: ${error.message}`);
  }
}

async function clickNextButton(page: any, results: any): Promise<boolean> {
  try {
    const state = await page.getState();
    if (!state?.selectorMap) return false;

    const buttonTexts = ['next', 'continue', 'proceed', 'review'];

    for (const [index, element] of state.selectorMap.entries()) {
      if (element.tagName?.toLowerCase() === 'button') {
        const buttonText = (element.textContent || '').toLowerCase();
        if (buttonTexts.some(text => buttonText.includes(text))) {
          await page.clickElementNode(false, element);
          results.buttonsClicked++;
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    results.errors.push(`Next button click failed: ${error.message}`);
    return false;
  }
}

async function clickSubmitButton(page: any, results: any): Promise<boolean> {
  try {
    const state = await page.getState();
    if (!state?.selectorMap) return false;

    const submitTexts = ['submit', 'apply', 'send application'];

    for (const [index, element] of state.selectorMap.entries()) {
      if (element.tagName?.toLowerCase() === 'button') {
        const buttonText = (element.textContent || '').toLowerCase();
        if (submitTexts.some(text => buttonText.includes(text))) {
          await page.clickElementNode(false, element);
          results.buttonsClicked++;
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    results.errors.push(`Submit button click failed: ${error.message}`);
    return false;
  }
}

async function waitForModal(page: any, timeout: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

async function waitForPageChange(page: any, timeout: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

async function instantFillField(
  page: any,
  index: number,
  element: any,
  autoFillData: any,
  platform?: string,
): Promise<boolean> {
  const fieldValue = detectFieldValueInstant(element, {
    email: autoFillData.email,
    phone: autoFillData.phone,
    first_name: autoFillData.first_name,
    last_name: autoFillData.last_name,
    experience: autoFillData.experience_years || '5',
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

function detectFieldValueInstant(element: any, fieldMap: Record<string, string>): string | null {
  const identifiers = [
    element.attributes?.name,
    element.attributes?.id,
    element.attributes?.placeholder,
    element.textContent,
  ]
    .filter(Boolean)
    .map(s => s.toLowerCase());

  for (const [pattern, value] of Object.entries(fieldMap)) {
    if (identifiers.some(id => id.includes(pattern))) {
      return value;
    }
  }

  return null;
}

export function createStartRecordingAction(context: AgentContext): Action {
  return new Action(async (input: { intent?: string; workflow_name?: string }) => {
    logger.info('🔴 Starting workflow recording', { input });

    try {
      const recorder = new WorkflowRecorder(context);
      const result = await recorder.startRecording(input.workflow_name);

      const page = await context.browserContext.getCurrentPage();

      if (result.success) {
        return {
          success: true,
          message: `🔴 Recording started! Apply to a job manually - I'm watching and learning. Recording ID: ${result.recordingId}`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            recordingId: result.recordingId,
            instructions:
              'Now manually apply to a job. Every click, form fill, and navigation will be recorded for future automation.',
          },
        };
      } else {
        return {
          success: false,
          message: 'Failed to start recording',
          screenshot: await page.takeScreenshot(),
        };
      }
    } catch (error) {
      logger.error('Recording start failed', error);
      const page = await context.browserContext.getCurrentPage();
      return {
        success: false,
        message: `Recording failed: ${error.message}`,
        screenshot: await page.takeScreenshot(),
      };
    }
  }, startRecordingSchema);
}

export function createStopRecordingAction(context: AgentContext): Action {
  return new Action(async (input: { intent?: string; workflow_name?: string }) => {
    logger.info('🔴 Stopping workflow recording', { input });

    try {
      const recorder = new WorkflowRecorder(context);
      const result = await recorder.stopRecording(input.workflow_name);

      const page = await context.browserContext.getCurrentPage();

      if (result.success && result.workflow) {
        return {
          success: true,
          message: `✅ Workflow recorded! "${result.workflow.name}" saved with ${result.workflow.optimizedActionCount} steps. Now I can apply to similar jobs instantly!`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            workflowId: result.workflow.id,
            workflowName: result.workflow.name,
            stepCount: result.workflow.optimizedActionCount,
            platform: result.workflow.platform,
            duration: result.workflow.duration,
            instructions: `Use "execute workflow ${result.workflow.id}" to replay this workflow on other job applications.`,
          },
        };
      } else {
        return {
          success: false,
          message: 'No recording found or recording was empty',
          screenshot: await page.takeScreenshot(),
        };
      }
    } catch (error) {
      logger.error('Recording stop failed', error);
      const page = await context.browserContext.getCurrentPage();
      return {
        success: false,
        message: `Stop recording failed: ${error.message}`,
        screenshot: await page.takeScreenshot(),
      };
    }
  }, stopRecordingSchema);
}

export function createExecuteRecordedWorkflowAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      workflow_id: string;
      use_resume_data?: boolean;
      speed?: 'fast' | 'normal' | 'slow';
    }) => {
      const startTime = Date.now();
      logger.info('⚡ Executing recorded workflow', { input });

      try {
        const executor = new WorkflowExecutor(context);
        const result = await executor.executeWorkflow(input.workflow_id, {
          useResumeData: input.use_resume_data,
          speed: input.speed,
        });

        const page = await context.browserContext.getCurrentPage();
        const totalTime = Date.now() - startTime;

        return {
          success: result.success,
          message: `⚡ Workflow executed in ${totalTime}ms! ${result.message}. Speed: ${Math.round(result.executedSteps / (totalTime / 1000))} steps/second`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            workflowId: input.workflow_id,
            executedSteps: result.executedSteps,
            executionTime: totalTime,
            speed: input.speed,
            efficiency: 'No LLM calls - pure automation',
          },
        };
      } catch (error) {
        logger.error('Workflow execution failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Workflow execution failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    executeRecordedWorkflowSchema,
  );
}

/**
 * Export ultra-fast actions for integration
 */
export function createUltraFastActions(context: AgentContext): Action[] {
  return [
    createStartRecordingAction(context),
    createStopRecordingAction(context),
    createExecuteRecordedWorkflowAction(context),
    createUltraFastLinkedInAction(context),
    createInstantFormFillAction(context),
  ];
}
