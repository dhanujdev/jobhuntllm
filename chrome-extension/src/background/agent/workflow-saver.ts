import type { AgentStepRecord } from './history';
import type { ActionResult } from './types';

/**
 * Workflow pattern for reusing successful job application flows
 */
export interface WorkflowPattern {
  id: string;
  name: string;
  platform: string; // linkedin, indeed, etc.
  applicationType: string; // easy_apply, ats_system, etc.
  steps: WorkflowStep[];
  successRate: number;
  averageTime: number;
  createdAt: string;
  lastUsed: string;
  usageCount: number;
}

export interface WorkflowStep {
  action: string;
  parameters: Record<string, any>;
  description: string;
  isAIRequired: boolean; // whether this step needs LLM
  fallbackAction?: string; // simpler alternative
}

/**
 * Workflow Saver - Converts successful agent executions into reusable macros
 */
export class WorkflowSaver {
  private static readonly STORAGE_KEY = 'jobhuntllm_workflows';

  /**
   * Analyze execution history and extract reusable workflow pattern
   */
  static async saveWorkflowFromHistory(
    history: AgentStepRecord[],
    platform: string,
    applicationType: string,
    customName?: string,
  ): Promise<WorkflowPattern> {
    const steps: WorkflowStep[] = [];

    for (const record of history) {
      if (record.result && record.result.length > 0) {
        for (const actionResult of record.result) {
          if (actionResult.extractedContent) {
            const step = this.convertActionToWorkflowStep(actionResult, record.modelOutput);
            if (step) {
              steps.push(step);
            }
          }
        }
      }
    }

    const workflow: WorkflowPattern = {
      id: this.generateWorkflowId(platform, applicationType),
      name: customName || `${platform} ${applicationType} - Auto Generated`,
      platform,
      applicationType,
      steps,
      successRate: 1.0, // Initial success rate
      averageTime: this.calculateExecutionTime(history),
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      usageCount: 1,
    };

    await this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Convert action result to reusable workflow step
   */
  private static convertActionToWorkflowStep(
    actionResult: ActionResult,
    modelOutput: string | null,
  ): WorkflowStep | null {
    // Extract action name from the result
    const actionName = this.extractActionName(actionResult.extractedContent || '');
    if (!actionName) return null;

    return {
      action: actionName,
      parameters: this.extractParameters(actionResult, modelOutput),
      description: actionResult.extractedContent || '',
      isAIRequired: this.determineIfAIRequired(actionName),
      fallbackAction: this.getSimplerAlternative(actionName),
    };
  }

  /**
   * Execute saved workflow with minimal AI usage
   */
  static async executeWorkflow(
    workflowId: string,
    context: any,
    useAI: boolean = false,
  ): Promise<{ success: boolean; steps: number; message: string }> {
    const workflows = await this.loadWorkflows();
    const workflow = workflows.find(w => w.id === workflowId);

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    let executedSteps = 0;
    const errors: string[] = [];

    for (const step of workflow.steps) {
      try {
        if (step.isAIRequired && !useAI && step.fallbackAction) {
          // Use simpler alternative when AI is disabled
          await this.executeSimpleAction(step.fallbackAction, step.parameters, context);
        } else if (!step.isAIRequired) {
          // Execute deterministic action
          await this.executeSimpleAction(step.action, step.parameters, context);
        } else if (useAI) {
          // Execute AI-powered action
          await this.executeAIAction(step.action, step.parameters, context);
        } else {
          // Skip AI-required step when AI is disabled
          console.log(`Skipping AI-required step: ${step.description}`);
          continue;
        }

        executedSteps++;
      } catch (error) {
        errors.push(`Step ${executedSteps + 1}: ${error.message}`);
      }
    }

    // Update workflow usage stats
    await this.updateWorkflowStats(workflowId, executedSteps === workflow.steps.length);

    return {
      success: errors.length === 0,
      steps: executedSteps,
      message:
        errors.length > 0
          ? `Completed ${executedSteps} steps with errors: ${errors.join(', ')}`
          : `Successfully completed all ${executedSteps} steps`,
    };
  }

  /**
   * Get simplified action alternatives that don't require AI
   */
  private static getSimplerAlternative(actionName: string): string | undefined {
    const alternatives: Record<string, string> = {
      auto_fill_job_application: 'fill_known_fields',
      generate_cover_letter: 'use_template_cover_letter',
      handle_job_questions: 'use_standard_answers',
      detect_job_application_form: 'use_common_patterns',
    };

    return alternatives[actionName];
  }

  /**
   * Determine if action requires AI reasoning
   */
  private static determineIfAIRequired(actionName: string): boolean {
    const aiRequiredActions = ['generate_cover_letter', 'handle_job_questions', 'detect_job_application_form'];

    return aiRequiredActions.includes(actionName);
  }

  /**
   * Execute simple action without AI
   */
  private static async executeSimpleAction(
    action: string,
    parameters: Record<string, any>,
    context: any,
  ): Promise<void> {
    switch (action) {
      case 'fill_known_fields':
        await this.fillKnownFields(parameters, context);
        break;
      case 'use_template_cover_letter':
        await this.useTemplateCoverLetter(parameters, context);
        break;
      case 'use_standard_answers':
        await this.useStandardAnswers(parameters, context);
        break;
      case 'click_element':
        await this.clickElement(parameters, context);
        break;
      case 'input_text':
        await this.inputText(parameters, context);
        break;
      default:
        console.log(`Simple action ${action} not implemented`);
    }
  }

  /**
   * Execute AI-powered action
   */
  private static async executeAIAction(action: string, parameters: Record<string, any>, context: any): Promise<void> {
    // Use the existing action system
    const actions = context.actions || [];
    const targetAction = actions.find((a: any) => a.name() === action);

    if (targetAction) {
      await targetAction.call(parameters);
    }
  }

  /**
   * Fill form fields using stored patterns (no AI needed)
   */
  private static async fillKnownFields(parameters: Record<string, any>, context: any): Promise<void> {
    // Get stored resume data
    const resumeData = await chrome.storage.local.get('jobhuntllm_resume_data');
    const page = await context.browserContext.getCurrentPage();
    const state = await page.getState();

    // Use known field patterns to fill forms
    const fieldMappings = {
      firstName: ['first_name', 'firstname', 'fname'],
      lastName: ['last_name', 'lastname', 'lname'],
      email: ['email', 'email_address'],
      phone: ['phone', 'phone_number', 'mobile'],
    };

    for (const [dataKey, fieldNames] of Object.entries(fieldMappings)) {
      for (const [index, element] of state.selectorMap.entries()) {
        if (this.matchesFieldName(element, fieldNames)) {
          const value = resumeData.jobhuntllm_resume_data?.personalInfo?.[dataKey];
          if (value) {
            await page.inputTextElementNode(false, element, value);
          }
        }
      }
    }
  }

  /**
   * Use template cover letter (no AI needed)
   */
  private static async useTemplateCoverLetter(parameters: Record<string, any>, context: any): Promise<void> {
    const resumeData = await chrome.storage.local.get('jobhuntllm_resume_data');
    const template = resumeData.jobhuntllm_resume_data?.documents?.coverLetterTemplate || '';

    // Replace basic placeholders
    const coverLetter = template
      .replace('{firstName}', resumeData.jobhuntllm_resume_data?.personalInfo?.firstName || '')
      .replace('{companyName}', parameters.companyName || '[Company Name]')
      .replace('{currentTitle}', resumeData.jobhuntllm_resume_data?.professional?.currentTitle || '');

    // Find and fill cover letter field
    const page = await context.browserContext.getCurrentPage();
    const state = await page.getState();

    for (const [index, element] of state.selectorMap.entries()) {
      if (
        element.tagName?.toLowerCase() === 'textarea' &&
        (element.attributes?.name?.includes('cover') || element.attributes?.placeholder?.includes('cover'))
      ) {
        await page.inputTextElementNode(false, element, coverLetter);
        break;
      }
    }
  }

  /**
   * Save workflow to storage
   */
  private static async saveWorkflow(workflow: WorkflowPattern): Promise<void> {
    const workflows = await this.loadWorkflows();
    const existingIndex = workflows.findIndex(w => w.id === workflow.id);

    if (existingIndex >= 0) {
      workflows[existingIndex] = workflow;
    } else {
      workflows.push(workflow);
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY]: workflows });
  }

  /**
   * Load all workflows
   */
  static async loadWorkflows(): Promise<WorkflowPattern[]> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  /**
   * Get workflows by platform
   */
  static async getWorkflowsForPlatform(platform: string): Promise<WorkflowPattern[]> {
    const workflows = await this.loadWorkflows();
    return workflows.filter(w => w.platform === platform);
  }

  // Helper methods
  private static generateWorkflowId(platform: string, type: string): string {
    return `${platform}_${type}_${Date.now()}`;
  }

  private static calculateExecutionTime(history: AgentStepRecord[]): number {
    // Calculate based on metadata timestamps
    return history.length * 2000; // Rough estimate: 2 seconds per step
  }

  private static extractActionName(content: string): string | null {
    // Extract action name from execution result
    const patterns = [
      /Clicked.*with index (\d+)/,
      /Input .* into index (\d+)/,
      /Auto-filled (\d+) fields/,
      /Generated.*cover letter/,
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        if (content.includes('Clicked')) return 'click_element';
        if (content.includes('Input')) return 'input_text';
        if (content.includes('Auto-filled')) return 'auto_fill_job_application';
        if (content.includes('cover letter')) return 'generate_cover_letter';
      }
    }

    return null;
  }

  private static extractParameters(actionResult: ActionResult, modelOutput: string | null): Record<string, any> {
    // Extract parameters from model output or action result
    try {
      if (modelOutput) {
        const parsed = JSON.parse(modelOutput);
        return parsed.action?.[0] || {};
      }
    } catch {
      // Fallback to extracting from content
    }

    return {};
  }

  private static matchesFieldName(element: any, fieldNames: string[]): boolean {
    const elementIdentifiers = [element.attributes?.name, element.attributes?.id, element.attributes?.placeholder]
      .filter(Boolean)
      .map(s => s.toLowerCase());

    return fieldNames.some(name => elementIdentifiers.some(id => id.includes(name)));
  }

  private static async updateWorkflowStats(workflowId: string, success: boolean): Promise<void> {
    const workflows = await this.loadWorkflows();
    const workflow = workflows.find(w => w.id === workflowId);

    if (workflow) {
      workflow.usageCount++;
      workflow.lastUsed = new Date().toISOString();
      workflow.successRate = (workflow.successRate + (success ? 1 : 0)) / 2;

      await this.saveWorkflow(workflow);
    }
  }

  private static async clickElement(parameters: Record<string, any>, context: any): Promise<void> {
    const page = await context.browserContext.getCurrentPage();
    const state = await page.getState();
    const element = state.selectorMap.get(parameters.index);

    if (element) {
      await page.clickElementNode(false, element);
    }
  }

  private static async inputText(parameters: Record<string, any>, context: any): Promise<void> {
    const page = await context.browserContext.getCurrentPage();
    const state = await page.getState();
    const element = state.selectorMap.get(parameters.index);

    if (element) {
      await page.inputTextElementNode(false, element, parameters.text);
    }
  }

  private static async useStandardAnswers(parameters: Record<string, any>, context: any): Promise<void> {
    const standardAnswers = {
      years_experience: '5+ years',
      authorized_to_work: 'Yes',
      require_sponsorship: 'No',
      salary_expectation: 'Competitive',
      available_start: 'Immediate',
    };

    // Implementation would match questions to standard answers
    console.log('Using standard answers for job questions');
  }
}
