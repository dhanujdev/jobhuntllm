import { ActionResult, type AgentContext } from '@src/background/agent/types';
import { createLogger } from '@src/background/log';
import { ResumeManager } from '../data/resume-manager';
import { Action } from './builder';
import { z } from 'zod';
import {
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
} from './jobhunt-schemas';
import { WorkflowSaver } from '../workflow-saver';
import { jobApplicationFieldPatterns } from '../prompts/templates/jobhunt';
import { createBatchActions } from './batch-actions';
import { DynamicFormObserver } from '../optimizations/form-observer';
import { responseCache } from '../optimizations/response-cache';
import { createUltraFastActions } from './ultra-fast-actions';

const logger = createLogger('JobHuntActions');

/**
 * Auto-fill job application form using stored resume data
 */
export function createAutoFillJobApplicationAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      application_type?: 'quick_apply' | 'multi_step' | 'ats_system' | 'company_portal';
      skip_fields?: string[];
      custom_field_name?: string;
      custom_field_value?: string;
    }) => {
      logger.info('Auto-filling job application form', { input });

      try {
        const autoFillData = await ResumeManager.getAutoFillData();
        if (!autoFillData) {
          const page = await context.browserContext.getCurrentPage();
          return {
            success: false,
            message: 'No resume data found. Please set up your resume data first.',
            screenshot: await page.takeScreenshot(),
          };
        }

        const page = await context.browserContext.getCurrentPage();
        const skipFields = input.skip_fields || [];

        // Get current page state with form elements
        const state = await page.getState();
        if (!state || !state.selectorMap) {
          return {
            success: false,
            message: 'Could not get page state for form analysis',
            screenshot: await page.takeScreenshot(),
          };
        }

        let filledCount = 0;
        const errors: string[] = [];

        // Process each element in the selector map
        for (const [index, elementNode] of state.selectorMap.entries()) {
          if (!elementNode.isInteractable()) {
            continue;
          }

          const tagName = elementNode.tagName?.toLowerCase();
          if (!['input', 'textarea', 'select'].includes(tagName || '')) {
            continue;
          }

          const fieldKey = matchFieldToResumeDataFromElement(elementNode);
          let valueToFill = '';

          if (fieldKey && autoFillData[fieldKey]) {
            valueToFill = autoFillData[fieldKey];
          } else if (
            input.custom_field_name &&
            input.custom_field_value &&
            (elementNode.attributes?.name === input.custom_field_name ||
              elementNode.attributes?.id === input.custom_field_name)
          ) {
            valueToFill = input.custom_field_value;
          }

          if (valueToFill && !elementNode.attributes?.value) {
            try {
              if (tagName === 'select') {
                // For dropdowns, try to select the option
                const options = await page.getDropdownOptions(index);
                const matchingOption = options.find(
                  opt =>
                    opt.text.toLowerCase().includes(valueToFill.toLowerCase()) ||
                    opt.value.toLowerCase().includes(valueToFill.toLowerCase()),
                );
                if (matchingOption) {
                  await page.selectDropdownOption(index, matchingOption.text);
                  filledCount++;
                }
              } else {
                // For input/textarea elements
                await page.inputTextElementNode(context.options.useVision, elementNode, valueToFill);
                filledCount++;
              }
            } catch (error) {
              errors.push(`Failed to fill element ${index}: ${error.message}`);
            }
          }
        }

        return {
          success: true,
          message: `Auto-filled ${filledCount} fields successfully. ${errors.length > 0 ? `Errors: ${errors.join(', ')}` : ''}`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            filledCount,
            totalElements: Array.from(state.selectorMap.values()).length,
            errors,
          },
        };
      } catch (error) {
        logger.error('Auto-fill failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Auto-fill failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    autoFillJobApplicationSchema,
  );
}

/**
 * Generate and fill customized cover letter
 */
export function createGenerateCoverLetterAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      job_title: string;
      company_name: string;
      job_description: string;
      target_field_index?: number;
    }) => {
      logger.info('Generating cover letter', { input });

      try {
        const coverLetter = await ResumeManager.generateCustomCoverLetter(input.job_description, input.company_name);

        let page = await context.browserContext.getCurrentPage();

        if (input.target_field_index !== undefined) {
          const textareas = await page.$$('textarea');

          if (textareas[input.target_field_index]) {
            await textareas[input.target_field_index].fill(coverLetter);
          }
        }

        return {
          success: true,
          message: 'Cover letter generated and filled successfully',
          screenshot: await page.takeScreenshot(),
          metadata: {
            coverLetter,
            jobTitle: input.job_title,
            companyName: input.company_name,
          },
        };
      } catch (error) {
        logger.error('Cover letter generation failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Cover letter generation failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    generateCoverLetterSchema,
  );
}

/**
 * Track job application for future reference
 */
export function createTrackApplicationAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      job_title: string;
      company_name: string;
      platform: string;
      application_id?: string;
      application_url?: string;
      notes?: string;
    }) => {
      logger.info('Tracking application', { input });

      try {
        await ResumeManager.trackApplication({
          jobTitle: input.job_title,
          company: input.company_name,
          platform: input.platform,
          applicationId: input.application_id,
          notes: input.notes,
        });

        const page = await context.browserContext.getCurrentPage();
        return {
          success: true,
          message: `Application tracked: ${input.job_title} at ${input.company_name}`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            trackedApplication: {
              jobTitle: input.job_title,
              company: input.company_name,
              platform: input.platform,
              applicationId: input.application_id,
            },
          },
        };
      } catch (error) {
        logger.error('Application tracking failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Application tracking failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    trackApplicationSchema,
  );
}

/**
 * Check if user has already applied to avoid duplicates
 */
export function createSkipDuplicateApplicationAction(context: AgentContext): Action {
  return new Action(
    async (input: { intent?: string; job_title: string; company_name: string; force_apply?: boolean }) => {
      logger.info('Checking for duplicate application', { input });

      try {
        const hasApplied = await ResumeManager.hasAppliedTo(input.job_title, input.company_name);

        const page = await context.browserContext.getCurrentPage();

        if (hasApplied && !input.force_apply) {
          return {
            success: true,
            message: `Already applied to ${input.job_title} at ${input.company_name}. Skipping.`,
            screenshot: await page.takeScreenshot(),
            metadata: {
              isDuplicate: true,
              skipped: true,
            },
          };
        }

        return {
          success: true,
          message: hasApplied
            ? 'Duplicate detected but force_apply enabled'
            : 'No duplicate found, proceeding with application',
          screenshot: await page.takeScreenshot(),
          metadata: {
            isDuplicate: hasApplied,
            skipped: false,
          },
        };
      } catch (error) {
        logger.error('Duplicate check failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Duplicate check failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    skipDuplicateApplicationSchema,
  );
}

/**
 * Handle LinkedIn Easy Apply workflow
 */
export function createHandleLinkedInEasyApplyAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      step: 'initial' | 'contact_info' | 'resume' | 'questions' | 'review' | 'submit';
      auto_advance?: boolean;
    }) => {
      logger.info('Handling LinkedIn Easy Apply', { input });

      try {
        const page = await context.browserContext.getCurrentPage();
        let message = '';
        let nextAction = '';

        switch (input.step) {
          case 'initial':
            message = 'LinkedIn Easy Apply workflow initiated - use click_element action to click Easy Apply button';
            nextAction = 'contact_info';
            break;

          case 'contact_info':
            message = 'Contact info step - use auto_fill_job_application action to fill contact details';
            nextAction = 'resume';
            break;

          case 'resume':
            message = 'Resume step - use upload_resume action if file upload is required';
            nextAction = 'questions';
            break;

          case 'questions':
            message = 'Questions step - use handle_job_questions action for screening questions';
            nextAction = 'review';
            break;

          case 'review':
            message = 'Review step - verify application details before submission';
            nextAction = 'submit';
            break;

          case 'submit':
            message = 'Submit step - use click_element action to submit the application';
            break;
        }

        return {
          success: true,
          message,
          screenshot: await page.takeScreenshot(),
          metadata: {
            currentStep: input.step,
            nextStep: nextAction,
            autoAdvanced: input.auto_advance && nextAction,
          },
        };
      } catch (error) {
        logger.error('LinkedIn Easy Apply failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `LinkedIn Easy Apply failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    handleLinkedInEasyApplySchema,
  );
}

/**
 * Save current execution as a reusable workflow
 */
export function createSaveWorkflowAction(context: AgentContext): Action {
  return new Action(
    async (input: {
      intent?: string;
      platform: string;
      application_type: string;
      workflow_name?: string;
      include_ai_steps?: boolean;
    }) => {
      logger.info('Saving workflow pattern', { input });

      try {
        // Get execution history from context
        const history = context.history?.history || [];

        if (history.length === 0) {
          const page = await context.browserContext.getCurrentPage();
          return {
            success: false,
            message: 'No execution history found to save as workflow',
            screenshot: await page.takeScreenshot(),
          };
        }

        const workflow = await WorkflowSaver.saveWorkflowFromHistory(
          history,
          input.platform,
          input.application_type,
          input.workflow_name,
        );

        const page = await context.browserContext.getCurrentPage();
        return {
          success: true,
          message: `Workflow saved: ${workflow.name} with ${workflow.steps.length} steps`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            workflowId: workflow.id,
            stepCount: workflow.steps.length,
            platform: workflow.platform,
          },
        };
      } catch (error) {
        logger.error('Workflow saving failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Workflow saving failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    saveWorkflowSchema,
  );
}

/**
 * Execute a saved workflow with minimal AI usage
 */
export function createExecuteWorkflowAction(context: AgentContext): Action {
  return new Action(async (input: { intent?: string; workflow_id: string; use_ai?: boolean; custom_data?: string }) => {
    logger.info('Executing saved workflow', { input });

    try {
      const result = await WorkflowSaver.executeWorkflow(input.workflow_id, context, input.use_ai || false);

      const page = await context.browserContext.getCurrentPage();
      return {
        success: result.success,
        message: result.message,
        screenshot: await page.takeScreenshot(),
        metadata: {
          workflowId: input.workflow_id,
          stepsExecuted: result.steps,
          aiUsed: input.use_ai,
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
  }, executeWorkflowSchema);
}

/**
 * Helper function to match form fields with resume data using DOMElementNode
 */
function matchFieldToResumeDataFromElement(elementNode: any): string | null {
  const fieldIdentifiers = [
    elementNode.attributes?.name,
    elementNode.attributes?.id,
    elementNode.attributes?.placeholder,
    elementNode.textContent,
  ]
    .map(s => s?.toLowerCase() || '')
    .filter(s => s);

  // Check each category of field patterns
  for (const [category, patterns] of Object.entries(jobApplicationFieldPatterns)) {
    for (const [key, regexPatterns] of Object.entries(patterns)) {
      for (const pattern of regexPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (fieldIdentifiers.some(identifier => regex.test(identifier))) {
          return key;
        }
      }
    }
  }

  return null;
}

/**
 * Create optimized job application action with dynamic form observation
 */
export function createOptimizedJobApplicationAction(context: AgentContext): Action {
  return new Action(
    async (input: { intent?: string; enable_observer?: boolean; use_cache?: boolean; platform?: string }) => {
      logger.info('Starting optimized job application', { input });

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

        let results = {
          fieldsProcessed: 0,
          questionsAnswered: 0,
          cacheHits: 0,
          totalTime: 0,
        };

        // Enable dynamic form observation if requested
        if (input.enable_observer) {
          const observer = new DynamicFormObserver(context);
          await observer.startObserving();
          logger.info('Dynamic form observer enabled for real-time processing');
        }

        // Process form with caching if enabled
        if (input.use_cache) {
          const stats = responseCache.getCacheStats();
          logger.info(`Response cache loaded with ${stats.totalEntries} entries`);
        }

        // Get page state and process forms
        const state = await page.getState();
        if (state?.selectorMap) {
          for (const [index, element] of state.selectorMap.entries()) {
            const tagName = element.tagName?.toLowerCase();

            if (['input', 'textarea', 'select'].includes(tagName || '') && element.isInteractable()) {
              // Check cache first for questions
              if (tagName === 'textarea' && input.use_cache) {
                const questionText = element.attributes?.placeholder || element.textContent || '';
                const cachedResponse = await responseCache.getCachedResponse(questionText, {
                  platform: input.platform,
                  companyName: autoFillData.current_company,
                });

                if (cachedResponse) {
                  await page.inputTextElementNode(false, element, cachedResponse);
                  results.questionsAnswered++;
                  results.cacheHits++;
                  continue;
                }
              }

              // Regular field processing
              const fieldKey = matchFieldToResumeDataFromElement(element);
              if (fieldKey && autoFillData[fieldKey]) {
                try {
                  if (tagName === 'select') {
                    const options = await page.getDropdownOptions(index);
                    const matchingOption = options.find(opt =>
                      opt.text.toLowerCase().includes(autoFillData[fieldKey].toLowerCase()),
                    );
                    if (matchingOption) {
                      await page.selectDropdownOption(index, matchingOption.text);
                      results.fieldsProcessed++;
                    }
                  } else {
                    await page.inputTextElementNode(false, element, autoFillData[fieldKey]);
                    results.fieldsProcessed++;
                  }
                } catch (error) {
                  logger.error(`Failed to fill field ${index}`, error);
                }
              }
            }
          }
        }

        const totalTime = Date.now() - startTime;
        results.totalTime = totalTime;

        return {
          success: true,
          message: `Optimized application completed: ${results.fieldsProcessed} fields, ${results.questionsAnswered} questions (${results.cacheHits} from cache) in ${totalTime}ms`,
          screenshot: await page.takeScreenshot(),
          metadata: {
            ...results,
            efficiency: `${Math.round(results.fieldsProcessed / (totalTime / 1000))} fields/second`,
            cacheEfficiency:
              results.questionsAnswered > 0
                ? `${Math.round((results.cacheHits / results.questionsAnswered) * 100)}%`
                : '0%',
          },
        };
      } catch (error) {
        logger.error('Optimized application failed', error);
        const page = await context.browserContext.getCurrentPage();
        return {
          success: false,
          message: `Optimized application failed: ${error.message}`,
          screenshot: await page.takeScreenshot(),
        };
      }
    },
    {
      name: 'optimized_job_application',
      description:
        'Complete job application with advanced optimizations including dynamic form observation and response caching.',
      schema: z.object({
        intent: z.string().default('').describe('purpose of this action'),
        enable_observer: z.boolean().default(true).describe('enable dynamic form observation'),
        use_cache: z.boolean().default(true).describe('use response caching for questions'),
        platform: z.string().optional().describe('job platform name for context'),
      }),
    },
  );
}

/**
 * Create all job hunt actions
 */
export function createJobHuntActions(context: AgentContext): Action[] {
  const batchActions = createBatchActions(context);
  const ultraFastActions = createUltraFastActions(context);

  return [
    ...ultraFastActions, // Ultra-fast no-LLM actions (highest priority)
    ...batchActions, // High-speed batch actions
    createOptimizedJobApplicationAction(context), // New optimized action
    createAutoFillJobApplicationAction(context),
    createGenerateCoverLetterAction(context),
    createTrackApplicationAction(context),
    createSkipDuplicateApplicationAction(context),
    createSaveWorkflowAction(context),
    createExecuteWorkflowAction(context),
    // Temporarily disabled complex actions for stability
    // createHandleLinkedInEasyApplyAction(context),
  ];
}
