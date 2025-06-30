import { createLogger } from '@src/background/log';
import type { AgentContext } from './types';

const logger = createLogger('WorkflowRecorder');

/**
 * Records user actions to create reusable job application workflows
 */
export class WorkflowRecorder {
  private isRecording: boolean = false;
  private currentWorkflow: WorkflowStep[] = [];
  private startTime: number = 0;
  private recordingId: string = '';

  constructor(private context: AgentContext) {}

  /**
   * Start recording user actions
   */
  async startRecording(workflowName?: string): Promise<{ success: boolean; recordingId: string }> {
    try {
      this.isRecording = true;
      this.currentWorkflow = [];
      this.startTime = Date.now();
      this.recordingId = `workflow_${Date.now()}`;

      const page = await this.context.browserContext.getCurrentPage();

      // Inject recording script into the page
      await page.evaluate((recordingId: string) => {
        // Initialize recording on page
        (window as any).workflowRecording = {
          id: recordingId,
          actions: [],
          isRecording: true,
        };

        // Track all user interactions
        const trackEvent = (eventType: string, element: Element, data?: any) => {
          const recording = (window as any).workflowRecording;
          if (!recording.isRecording) return;

          const elementData = {
            tagName: element.tagName.toLowerCase(),
            id: element.id || '',
            className: element.className || '',
            textContent: element.textContent?.trim().substring(0, 100) || '',
            name: (element as HTMLInputElement).name || '',
            type: (element as HTMLInputElement).type || '',
            placeholder: (element as HTMLInputElement).placeholder || '',
            xpath: getElementXPath(element),
          };

          recording.actions.push({
            timestamp: Date.now(),
            type: eventType,
            element: elementData,
            data: data || null,
            url: window.location.href,
          });

          console.log(`[WorkflowRecorder] Recorded: ${eventType}`, elementData);
        };

        // Helper function to get XPath
        function getElementXPath(element: Element): string {
          if (element.id) return `//*[@id="${element.id}"]`;

          const segments: string[] = [];
          let currentElement: Element | null = element;

          while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = currentElement.previousElementSibling;

            while (sibling) {
              if (sibling.tagName === currentElement.tagName) index++;
              sibling = sibling.previousElementSibling;
            }

            const tagName = currentElement.tagName.toLowerCase();
            segments.unshift(`${tagName}[${index}]`);
            currentElement = currentElement.parentElement;
          }

          return `/${segments.join('/')}`;
        }

        // Track clicks
        document.addEventListener(
          'click',
          e => {
            trackEvent('click', e.target as Element);
          },
          true,
        );

        // Track form inputs
        document.addEventListener(
          'input',
          e => {
            const target = e.target as HTMLInputElement;
            trackEvent('input', target, {
              value: target.value,
              inputType: target.type,
            });
          },
          true,
        );

        // Track dropdown selections
        document.addEventListener(
          'change',
          e => {
            const target = e.target as HTMLSelectElement;
            if (target.tagName.toLowerCase() === 'select') {
              trackEvent('select', target, {
                selectedValue: target.value,
                selectedText: target.options[target.selectedIndex]?.text,
              });
            }
          },
          true,
        );

        // Track key presses (for special keys like Tab, Enter)
        document.addEventListener(
          'keydown',
          e => {
            if (['Tab', 'Enter', 'Escape'].includes(e.key)) {
              trackEvent('keypress', e.target as Element, {
                key: e.key,
                keyCode: e.keyCode,
              });
            }
          },
          true,
        );

        // Track page navigation
        let currentUrl = window.location.href;
        setInterval(() => {
          if (window.location.href !== currentUrl) {
            trackEvent('navigation', document.body, {
              fromUrl: currentUrl,
              toUrl: window.location.href,
            });
            currentUrl = window.location.href;
          }
        }, 1000);

        console.log(`[WorkflowRecorder] Started recording workflow: ${recordingId}`);
      }, this.recordingId);

      logger.info(`Started recording workflow: ${this.recordingId}`);

      return {
        success: true,
        recordingId: this.recordingId,
      };
    } catch (error) {
      logger.error('Failed to start workflow recording', error);
      return {
        success: false,
        recordingId: '',
      };
    }
  }

  /**
   * Stop recording and save the workflow
   */
  async stopRecording(workflowName?: string): Promise<{ success: boolean; workflow?: SavedWorkflow }> {
    try {
      if (!this.isRecording) {
        return { success: false };
      }

      const page = await this.context.browserContext.getCurrentPage();

      // Get recorded actions from page
      const recordedActions = await page.evaluate(() => {
        const recording = (window as any).workflowRecording;
        if (recording) {
          recording.isRecording = false;
          return recording.actions;
        }
        return [];
      });

      this.isRecording = false;

      if (recordedActions.length === 0) {
        logger.warn('No actions were recorded');
        return { success: false };
      }

      // Process and optimize the recorded workflow
      const optimizedWorkflow = this.optimizeWorkflow(recordedActions);

      // Create saved workflow
      const savedWorkflow: SavedWorkflow = {
        id: this.recordingId,
        name: workflowName || `Recorded Workflow ${new Date().toLocaleDateString()}`,
        platform: this.detectPlatform(recordedActions),
        steps: optimizedWorkflow,
        recordedAt: this.startTime,
        duration: Date.now() - this.startTime,
        actionCount: recordedActions.length,
        optimizedActionCount: optimizedWorkflow.length,
        successRate: 1.0, // Initial success rate
        usageCount: 0,
      };

      // Save to storage
      await this.saveWorkflow(savedWorkflow);

      logger.info(`Workflow recorded successfully: ${savedWorkflow.name}`, {
        originalActions: recordedActions.length,
        optimizedActions: optimizedWorkflow.length,
        duration: savedWorkflow.duration,
      });

      return {
        success: true,
        workflow: savedWorkflow,
      };
    } catch (error) {
      logger.error('Failed to stop workflow recording', error);
      return { success: false };
    }
  }

  /**
   * Optimize recorded actions by removing redundant steps and grouping related actions
   */
  private optimizeWorkflow(actions: RecordedAction[]): WorkflowStep[] {
    const optimized: WorkflowStep[] = [];
    let stepIndex = 0;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Skip very rapid duplicate actions (debounce)
      if (i > 0 && actions[i - 1].type === action.type && action.timestamp - actions[i - 1].timestamp < 100) {
        continue;
      }

      // Group form filling actions
      if (action.type === 'input') {
        const step: WorkflowStep = {
          stepIndex: stepIndex++,
          action: 'fill_field',
          element: action.element,
          data: action.data,
          timing: action.timestamp - this.startTime,
          description: `Fill ${action.element.name || action.element.type || 'field'}: ${action.data?.value || ''}`,
        };
        optimized.push(step);
      }

      // Handle clicks (buttons, links, etc.)
      else if (action.type === 'click') {
        const step: WorkflowStep = {
          stepIndex: stepIndex++,
          action: 'click_element',
          element: action.element,
          timing: action.timestamp - this.startTime,
          description: `Click ${action.element.tagName}: ${action.element.textContent || action.element.id || action.element.className}`,
        };
        optimized.push(step);
      }

      // Handle dropdown selections
      else if (action.type === 'select') {
        const step: WorkflowStep = {
          stepIndex: stepIndex++,
          action: 'select_option',
          element: action.element,
          data: action.data,
          timing: action.timestamp - this.startTime,
          description: `Select: ${action.data?.selectedText || action.data?.selectedValue}`,
        };
        optimized.push(step);
      }

      // Handle special key presses
      else if (action.type === 'keypress') {
        const step: WorkflowStep = {
          stepIndex: stepIndex++,
          action: 'key_press',
          element: action.element,
          data: action.data,
          timing: action.timestamp - this.startTime,
          description: `Press key: ${action.data?.key}`,
        };
        optimized.push(step);
      }

      // Handle page navigation
      else if (action.type === 'navigation') {
        const step: WorkflowStep = {
          stepIndex: stepIndex++,
          action: 'navigate',
          element: action.element,
          data: action.data,
          timing: action.timestamp - this.startTime,
          description: `Navigate to: ${action.data?.toUrl}`,
        };
        optimized.push(step);
      }
    }

    return optimized;
  }

  /**
   * Detect the job platform from recorded actions
   */
  private detectPlatform(actions: RecordedAction[]): string {
    const urls = actions.map(a => a.url).join(' ');

    if (urls.includes('linkedin.com')) return 'linkedin';
    if (urls.includes('indeed.com')) return 'indeed';
    if (urls.includes('glassdoor.com')) return 'glassdoor';
    if (urls.includes('workday')) return 'workday';
    if (urls.includes('greenhouse')) return 'greenhouse';

    return 'other';
  }

  /**
   * Save workflow to storage
   */
  private async saveWorkflow(workflow: SavedWorkflow): Promise<void> {
    try {
      const existingWorkflows = await chrome.storage.local.get('recorded_workflows');
      const workflows = existingWorkflows.recorded_workflows || [];

      workflows.push(workflow);

      await chrome.storage.local.set({ recorded_workflows: workflows });
    } catch (error) {
      logger.error('Failed to save workflow', error);
      throw error;
    }
  }

  /**
   * Get all saved workflows
   */
  static async getSavedWorkflows(): Promise<SavedWorkflow[]> {
    try {
      const result = await chrome.storage.local.get('recorded_workflows');
      return result.recorded_workflows || [];
    } catch (error) {
      logger.error('Failed to get saved workflows', error);
      return [];
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): { isRecording: boolean; recordingId: string; duration: number } {
    return {
      isRecording: this.isRecording,
      recordingId: this.recordingId,
      duration: this.isRecording ? Date.now() - this.startTime : 0,
    };
  }
}

/**
 * Workflow execution engine that replays recorded workflows
 */
export class WorkflowExecutor {
  constructor(private context: AgentContext) {}

  /**
   * Execute a saved workflow
   */
  async executeWorkflow(
    workflowId: string,
    options?: {
      useResumeData?: boolean;
      skipConfirmation?: boolean;
      speed?: 'fast' | 'normal' | 'slow';
    },
  ): Promise<{ success: boolean; message: string; executedSteps: number }> {
    try {
      const workflows = await WorkflowRecorder.getSavedWorkflows();
      const workflow = workflows.find(w => w.id === workflowId);

      if (!workflow) {
        return { success: false, message: 'Workflow not found', executedSteps: 0 };
      }

      logger.info(`Executing workflow: ${workflow.name}`);

      const page = await this.context.browserContext.getCurrentPage();
      const resumeData = options?.useResumeData ? await this.getResumeData() : null;

      let executedSteps = 0;
      const speed = options?.speed || 'fast';
      const baseDelay = speed === 'fast' ? 100 : speed === 'normal' ? 300 : 800;

      for (const step of workflow.steps) {
        try {
          await this.executeStep(page, step, resumeData);
          executedSteps++;

          // Add delay between steps to look more human
          await this.delay(baseDelay + Math.random() * 200);
        } catch (error) {
          logger.error(`Step ${step.stepIndex} failed`, error);
          // Continue with next step instead of failing completely
        }
      }

      // Update workflow usage statistics
      await this.updateWorkflowStats(workflowId, executedSteps === workflow.steps.length);

      return {
        success: executedSteps > 0,
        message: `Executed ${executedSteps}/${workflow.steps.length} steps`,
        executedSteps,
      };
    } catch (error) {
      logger.error('Workflow execution failed', error);
      return { success: false, message: `Execution failed: ${error.message}`, executedSteps: 0 };
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(page: any, step: WorkflowStep, resumeData?: any): Promise<void> {
    switch (step.action) {
      case 'fill_field':
        await this.fillField(page, step, resumeData);
        break;
      case 'click_element':
        await this.clickElement(page, step);
        break;
      case 'select_option':
        await this.selectOption(page, step);
        break;
      case 'key_press':
        await this.pressKey(page, step);
        break;
      case 'navigate':
        await this.navigate(page, step);
        break;
      default:
        logger.warn(`Unknown step action: ${step.action}`);
    }
  }

  private async fillField(page: any, step: WorkflowStep, resumeData?: any): Promise<void> {
    const element = await this.findElement(page, step.element);
    if (!element) return;

    let value = step.data?.value || '';

    // Use resume data if available and field is recognized
    if (resumeData && this.isResumeField(step.element)) {
      value = this.getResumeFieldValue(step.element, resumeData) || value;
    }

    await page.inputTextElementNode(false, element, value);
  }

  private async clickElement(page: any, step: WorkflowStep): Promise<void> {
    const element = await this.findElement(page, step.element);
    if (!element) return;

    await page.clickElementNode(false, element);
  }

  private async selectOption(page: any, step: WorkflowStep): Promise<void> {
    const element = await this.findElement(page, step.element);
    if (!element) return;

    const value = step.data?.selectedValue || step.data?.selectedText;
    if (value) {
      // Implementation depends on your page object's dropdown handling
      await page.selectDropdownOption(element.highlightIndex, value);
    }
  }

  private async pressKey(page: any, step: WorkflowStep): Promise<void> {
    const key = step.data?.key;
    if (key) {
      await page.sendKeys(key);
    }
  }

  private async navigate(page: any, step: WorkflowStep): Promise<void> {
    const url = step.data?.toUrl;
    if (url) {
      await page.navigateTo(url);
    }
  }

  private async findElement(page: any, elementData: RecordedElement): Promise<any> {
    const state = await page.getState();
    if (!state?.selectorMap) return null;

    // Try to find element by various attributes
    for (const [index, element] of state.selectorMap.entries()) {
      // Prefer ID match
      if (elementData.id && element.attributes?.id === elementData.id) {
        return element;
      }

      // Try name match
      if (elementData.name && element.attributes?.name === elementData.name) {
        return element;
      }

      // Try text content match
      if (elementData.textContent && element.textContent?.includes(elementData.textContent.substring(0, 50))) {
        return element;
      }
    }

    return null;
  }

  private isResumeField(element: RecordedElement): boolean {
    const identifiers = [element.name, element.id, element.placeholder].join(' ').toLowerCase();
    const resumeFields = ['email', 'phone', 'first_name', 'last_name', 'name'];
    return resumeFields.some(field => identifiers.includes(field));
  }

  private getResumeFieldValue(element: RecordedElement, resumeData: any): string | null {
    const identifiers = [element.name, element.id, element.placeholder].join(' ').toLowerCase();

    if (identifiers.includes('email')) return resumeData.email;
    if (identifiers.includes('phone')) return resumeData.phone;
    if (identifiers.includes('first') || identifiers.includes('fname')) return resumeData.first_name;
    if (identifiers.includes('last') || identifiers.includes('lname')) return resumeData.last_name;

    return null;
  }

  private async getResumeData(): Promise<any> {
    try {
      // This should integrate with your existing ResumeManager
      const { ResumeManager } = await import('../data/resume-manager');
      return await ResumeManager.getAutoFillData();
    } catch (error) {
      return null;
    }
  }

  private async updateWorkflowStats(workflowId: string, success: boolean): Promise<void> {
    try {
      const workflows = await WorkflowRecorder.getSavedWorkflows();
      const workflow = workflows.find(w => w.id === workflowId);

      if (workflow) {
        workflow.usageCount++;
        workflow.successRate =
          (workflow.successRate * (workflow.usageCount - 1) + (success ? 1 : 0)) / workflow.usageCount;

        await chrome.storage.local.set({ recorded_workflows: workflows });
      }
    } catch (error) {
      logger.error('Failed to update workflow stats', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Type definitions
interface RecordedAction {
  timestamp: number;
  type: 'click' | 'input' | 'select' | 'keypress' | 'navigation';
  element: RecordedElement;
  data?: any;
  url: string;
}

interface RecordedElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  name: string;
  type: string;
  placeholder: string;
  xpath: string;
}

interface WorkflowStep {
  stepIndex: number;
  action: 'fill_field' | 'click_element' | 'select_option' | 'key_press' | 'navigate';
  element: RecordedElement;
  data?: any;
  timing: number;
  description: string;
}

interface SavedWorkflow {
  id: string;
  name: string;
  platform: string;
  steps: WorkflowStep[];
  recordedAt: number;
  duration: number;
  actionCount: number;
  optimizedActionCount: number;
  successRate: number;
  usageCount: number;
}

export { WorkflowExecutor, type SavedWorkflow, type WorkflowStep };
