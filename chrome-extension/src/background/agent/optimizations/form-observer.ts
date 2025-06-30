import { createLogger } from '@src/background/log';
import { ResumeManager } from '../data/resume-manager';

const logger = createLogger('FormObserver');

/**
 * Dynamic Form Observer for real-time form changes (LinkedIn multi-step, etc.)
 */
export class DynamicFormObserver {
  private observers: Map<string, MutationObserver> = new Map();
  private processedQuestions: Map<string, any> = new Map();
  private formCache: Map<string, FormField[]> = new Map();
  private rateLimiter: RateLimiter = new RateLimiter();
  private isProcessing: boolean = false;

  constructor(private context: any) {}

  /**
   * Start observing a form container for dynamic changes
   */
  async startObserving(containerSelector: string = 'body'): Promise<void> {
    try {
      const page = await this.context.browserContext.getCurrentPage();

      // Inject the observer script into the page
      await page.evaluate(
        (selector: string, observerId: string) => {
          // Remove existing observer if any
          if ((window as any).formObservers?.[observerId]) {
            (window as any).formObservers[observerId].disconnect();
          }

          const container = document.querySelector(selector);
          if (!container) {
            console.warn(`Container ${selector} not found for form observer`);
            return;
          }

          // Initialize observers map
          if (!(window as any).formObservers) {
            (window as any).formObservers = {};
          }

          // Create MutationObserver for dynamic form changes
          const observer = new MutationObserver(mutations => {
            let hasFormChanges = false;
            const newElements: Element[] = [];

            mutations.forEach(mutation => {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element;

                    // Check if new form elements were added
                    const formElements = element.querySelectorAll('input, textarea, select, button');
                    if (formElements.length > 0) {
                      hasFormChanges = true;
                      newElements.push(...Array.from(formElements));
                    }

                    // Check if the element itself is a form element
                    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) {
                      hasFormChanges = true;
                      newElements.push(element);
                    }
                  }
                });
              }

              // Watch for attribute changes on form elements
              if (
                mutation.type === 'attributes' &&
                ['INPUT', 'TEXTAREA', 'SELECT'].includes((mutation.target as Element).tagName)
              ) {
                hasFormChanges = true;
                newElements.push(mutation.target as Element);
              }
            });

            if (hasFormChanges) {
              console.log(`[FormObserver] Detected ${newElements.length} new/changed form elements`);

              // Store changes in window for background script to access
              (window as any).formObserverChanges = {
                timestamp: Date.now(),
                elements: newElements.map(el => ({
                  tagName: el.tagName,
                  type: (el as HTMLInputElement).type || '',
                  name: (el as HTMLInputElement).name || '',
                  id: el.id || '',
                  placeholder: (el as HTMLInputElement).placeholder || '',
                  textContent: el.textContent?.trim() || '',
                  className: el.className || '',
                  required: (el as HTMLInputElement).required || false,
                })),
              };

              // Trigger custom event
              window.dispatchEvent(
                new CustomEvent('formChanged', {
                  detail: { elements: newElements.length },
                }),
              );
            }
          });

          // Start observing
          observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled', 'required', 'type', 'name'],
          });

          (window as any).formObservers[observerId] = observer;
          console.log(`[FormObserver] Started observing ${selector}`);
        },
        containerSelector,
        `observer_${Date.now()}`,
      );

      // Set up polling to check for changes
      this.startChangePolling();
    } catch (error) {
      logger.error('Failed to start form observation', error);
    }
  }

  /**
   * Process new form elements detected by observer
   */
  private async processFormChanges(changes: any): Promise<void> {
    if (this.isProcessing) {
      logger.info('Already processing form changes, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const newFields = await this.extractFormFields(changes.elements);
      const questionsToProcess = await this.filterNewQuestions(newFields);

      if (questionsToProcess.length > 0) {
        logger.info(`Processing ${questionsToProcess.length} new questions`);
        await this.processQuestionsBatch(questionsToProcess);
      }
    } catch (error) {
      logger.error('Error processing form changes', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Extract and categorize form fields from changes
   */
  private async extractFormFields(elementData: any[]): Promise<FormField[]> {
    const fields: FormField[] = [];

    for (const data of elementData) {
      const field: FormField = {
        id: data.id || `${data.tagName}_${Date.now()}`,
        type: this.categorizeField(data),
        element: data,
        text: data.textContent || data.placeholder || '',
        hash: this.generateFieldHash(data),
        isQuestion: this.isQuestionField(data),
        priority: this.calculateFieldPriority(data),
      };

      fields.push(field);
    }

    return fields.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Filter out already processed questions using cache
   */
  private async filterNewQuestions(fields: FormField[]): Promise<FormField[]> {
    return fields.filter(field => {
      if (!field.isQuestion) return true;

      const cached = this.processedQuestions.get(field.hash);
      if (cached) {
        logger.info(`Question already processed: ${field.text.substring(0, 50)}...`);
        return false;
      }

      return true;
    });
  }

  /**
   * Process multiple questions in a single batch to avoid rate limits
   */
  private async processQuestionsBatch(questions: FormField[]): Promise<void> {
    if (!(await this.rateLimiter.canProceed())) {
      logger.warn('Rate limit reached, delaying question processing');
      setTimeout(() => this.processQuestionsBatch(questions), 2000);
      return;
    }

    // Group questions by type for batch processing
    const questionGroups = this.groupQuestionsByType(questions);

    for (const [type, group] of Object.entries(questionGroups)) {
      if (group.length === 0) continue;

      try {
        await this.processQuestionGroup(type, group);
      } catch (error) {
        logger.error(`Failed to process question group ${type}`, error);
      }
    }
  }

  /**
   * Process a group of similar questions in one LLM call
   */
  private async processQuestionGroup(type: string, questions: FormField[]): Promise<void> {
    const resumeData = await ResumeManager.getAutoFillData();
    if (!resumeData) return;

    // Check cache first
    const cachedAnswers = new Map<string, string>();
    const uncachedQuestions = questions.filter(q => {
      const cached = this.processedQuestions.get(q.hash);
      if (cached) {
        cachedAnswers.set(q.id, cached.answer);
        return false;
      }
      return true;
    });

    // Process uncached questions
    if (uncachedQuestions.length > 0) {
      const answers = await this.getAnswersForQuestionGroup(type, uncachedQuestions, resumeData);

      // Cache the answers
      uncachedQuestions.forEach((question, index) => {
        const answer = answers[index];
        this.processedQuestions.set(question.hash, {
          answer,
          timestamp: Date.now(),
          type,
        });
        cachedAnswers.set(question.id, answer);
      });
    }

    // Fill the form fields
    await this.fillFormFields(cachedAnswers);
  }

  /**
   * Get answers for a group of questions in one LLM call
   */
  private async getAnswersForQuestionGroup(type: string, questions: FormField[], resumeData: any): Promise<string[]> {
    // Use templates for standard questions to avoid LLM calls
    if (type === 'standard') {
      return questions.map(q => this.getTemplateAnswer(q, resumeData));
    }

    // For complex questions, batch them into one LLM call
    const batchPrompt = this.createBatchPrompt(questions, resumeData);

    try {
      // This would integrate with your existing LLM system
      const response = await this.callLLMBatch(batchPrompt);
      return this.parseBatchResponse(response, questions.length);
    } catch (error) {
      logger.error('LLM batch call failed, using templates', error);
      return questions.map(q => this.getTemplateAnswer(q, resumeData));
    }
  }

  /**
   * Get template answer for standard questions (no LLM needed)
   */
  private getTemplateAnswer(question: FormField, resumeData: any): string {
    const text = question.text.toLowerCase();

    const templates: Record<string, string> = {
      bachelor: 'Yes',
      degree: 'Yes',
      authorized: 'Yes',
      sponsorship: 'No',
      visa: 'No',
      experience: resumeData.experience_years || '5+ years',
      salary: resumeData.salary_expectation || 'Competitive',
      start: resumeData.start_date || 'Immediate',
      available: 'Immediately available',
      relocate: resumeData.willing_to_relocate || 'Yes',
      remote: resumeData.remote_work || 'Yes',
      commute: 'Yes',
      onsite: 'Yes',
      'why interested': `I am excited about this opportunity because it aligns with my ${resumeData.experience_years} of experience.`,
      'why qualify': `My background in ${resumeData.technical_skills} makes me well-suited for this role.`,
    };

    for (const [key, answer] of Object.entries(templates)) {
      if (text.includes(key)) {
        return answer;
      }
    }

    return 'Yes'; // Default safe answer
  }

  /**
   * Start polling for form changes
   */
  private startChangePolling(): void {
    setInterval(async () => {
      try {
        const page = await this.context.browserContext.getCurrentPage();

        const changes = await page.evaluate(() => {
          const changes = (window as any).formObserverChanges;
          if (changes) {
            // Clear after reading
            (window as any).formObserverChanges = null;
            return changes;
          }
          return null;
        });

        if (changes) {
          await this.processFormChanges(changes);
        }
      } catch (error) {
        // Ignore polling errors to avoid spam
      }
    }, 1000); // Check every second
  }

  /**
   * Utility methods
   */
  private categorizeField(data: any): string {
    const text = (data.textContent + ' ' + data.placeholder).toLowerCase();

    if (text.includes('experience') || text.includes('years')) return 'experience';
    if (text.includes('degree') || text.includes('education')) return 'education';
    if (text.includes('salary') || text.includes('compensation')) return 'salary';
    if (text.includes('why') || text.includes('tell us')) return 'essay';

    return 'standard';
  }

  private isQuestionField(data: any): boolean {
    return (
      data.tagName === 'TEXTAREA' ||
      (data.tagName === 'INPUT' && ['text', 'email', 'tel'].includes(data.type)) ||
      data.tagName === 'SELECT'
    );
  }

  private generateFieldHash(data: any): string {
    const content = `${data.tagName}_${data.type}_${data.name}_${data.placeholder}_${data.textContent}`;
    return btoa(content).substring(0, 16); // Simple hash
  }

  private calculateFieldPriority(data: any): number {
    let priority = 1;
    if (data.required) priority += 2;
    if (data.tagName === 'TEXTAREA') priority += 1; // Questions likely in textareas
    return priority;
  }

  private groupQuestionsByType(questions: FormField[]): Record<string, FormField[]> {
    const groups: Record<string, FormField[]> = {
      standard: [],
      experience: [],
      education: [],
      salary: [],
      essay: [],
    };

    questions.forEach(q => {
      groups[q.type] = groups[q.type] || [];
      groups[q.type].push(q);
    });

    return groups;
  }

  private createBatchPrompt(questions: FormField[], resumeData: any): string {
    const questionTexts = questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n');

    return `Answer these job application questions based on the resume data:
${questionTexts}

Resume data: ${JSON.stringify(resumeData, null, 2)}

Respond with numbered answers, one per line.`;
  }

  private async callLLMBatch(prompt: string): Promise<string> {
    // This would integrate with your existing LLM calling mechanism
    // For now, return template response
    return '1. Yes\n2. 5+ years\n3. Competitive';
  }

  private parseBatchResponse(response: string, expectedCount: number): string[] {
    const lines = response.split('\n').filter(line => line.trim());
    const answers: string[] = [];

    for (let i = 0; i < expectedCount; i++) {
      const line = lines[i] || '';
      const answer = line.replace(/^\d+\.\s*/, '').trim() || 'Yes';
      answers.push(answer);
    }

    return answers;
  }

  private async fillFormFields(answers: Map<string, string>): Promise<void> {
    const page = await this.context.browserContext.getCurrentPage();

    for (const [fieldId, answer] of answers.entries()) {
      try {
        await page.evaluate(
          (id: string, value: string) => {
            const element = document.getElementById(id) as HTMLInputElement;
            if (element) {
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
            }
          },
          fieldId,
          answer,
        );
      } catch (error) {
        logger.error(`Failed to fill field ${fieldId}`, error);
      }
    }
  }

  /**
   * Clean up observers
   */
  stopObserving(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

/**
 * Rate limiter to prevent API overuse
 */
class RateLimiter {
  private calls: number[] = [];
  private readonly maxCalls = 10; // Max 10 calls
  private readonly timeWindow = 60000; // Per minute

  async canProceed(): Promise<boolean> {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.timeWindow);

    if (this.calls.length >= this.maxCalls) {
      return false;
    }

    this.calls.push(now);
    return true;
  }
}

/**
 * Form field interface
 */
interface FormField {
  id: string;
  type: string;
  element: any;
  text: string;
  hash: string;
  isQuestion: boolean;
  priority: number;
}

// DynamicFormObserver is already exported at the class definition above
