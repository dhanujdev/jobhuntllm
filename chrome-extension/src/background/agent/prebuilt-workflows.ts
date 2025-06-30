import type { WorkflowPattern } from './workflow-saver';

/**
 * Pre-built workflow templates for common job application scenarios
 */
export const PREBUILT_WORKFLOWS: WorkflowPattern[] = [
  {
    id: 'linkedin_easy_apply_fast',
    name: '⚡ LinkedIn Easy Apply (Fast)',
    platform: 'linkedin',
    applicationType: 'easy_apply',
    successRate: 0.95,
    averageTime: 45000, // 45 seconds
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsed: '2024-01-01T00:00:00.000Z',
    usageCount: 0,
    steps: [
      {
        action: 'batch_job_application',
        parameters: {
          mode: 'aggressive',
          platform: 'linkedin',
          auto_submit: false,
          skip_ai_questions: true,
          max_steps: 20,
        },
        description: 'Complete LinkedIn Easy Apply in batch mode',
        isAIRequired: false,
        fallbackAction: 'fast_form_fill',
      },
      {
        action: 'track_application',
        parameters: {
          platform: 'linkedin',
        },
        description: 'Save application to history',
        isAIRequired: false,
      },
    ],
  },

  {
    id: 'indeed_quick_apply_fast',
    name: '🔍 Indeed Quick Apply (Fast)',
    platform: 'indeed',
    applicationType: 'quick_apply',
    successRate: 0.9,
    averageTime: 60000, // 1 minute
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsed: '2024-01-01T00:00:00.000Z',
    usageCount: 0,
    steps: [
      {
        action: 'batch_job_application',
        parameters: {
          mode: 'smart',
          platform: 'indeed',
          auto_submit: false,
          skip_ai_questions: true,
          max_steps: 25,
        },
        description: 'Complete Indeed application with smart processing',
        isAIRequired: false,
        fallbackAction: 'fast_form_fill',
      },
      {
        action: 'track_application',
        parameters: {
          platform: 'indeed',
        },
        description: 'Save application to history',
        isAIRequired: false,
      },
    ],
  },

  {
    id: 'workday_ats_smart',
    name: '⚙️ Workday ATS (Smart)',
    platform: 'workday',
    applicationType: 'ats_system',
    successRate: 0.85,
    averageTime: 120000, // 2 minutes
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsed: '2024-01-01T00:00:00.000Z',
    usageCount: 0,
    steps: [
      {
        action: 'fast_form_fill',
        parameters: {
          use_templates: true,
          timeout_seconds: 60,
        },
        description: 'Fill standard Workday fields',
        isAIRequired: false,
      },
      {
        action: 'auto_fill_job_application',
        parameters: {
          application_type: 'ats_system',
        },
        description: 'Handle complex ATS fields',
        isAIRequired: false,
        fallbackAction: 'fast_form_fill',
      },
      {
        action: 'generate_cover_letter',
        parameters: {},
        description: 'Create custom cover letter if required',
        isAIRequired: true,
        fallbackAction: 'use_template_cover_letter',
      },
      {
        action: 'track_application',
        parameters: {
          platform: 'workday',
        },
        description: 'Save application to history',
        isAIRequired: false,
      },
    ],
  },

  {
    id: 'generic_fast_apply',
    name: '🚀 Generic Fast Apply',
    platform: 'other',
    applicationType: 'company_portal',
    successRate: 0.8,
    averageTime: 90000, // 1.5 minutes
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsed: '2024-01-01T00:00:00.000Z',
    usageCount: 0,
    steps: [
      {
        action: 'fast_form_fill',
        parameters: {
          use_templates: true,
          timeout_seconds: 45,
        },
        description: 'Rapid form filling with templates',
        isAIRequired: false,
      },
      {
        action: 'skip_duplicate_application',
        parameters: {},
        description: 'Check for duplicate applications',
        isAIRequired: false,
      },
      {
        action: 'track_application',
        parameters: {
          platform: 'other',
        },
        description: 'Save application to history',
        isAIRequired: false,
      },
    ],
  },
];

/**
 * Speed-optimized command shortcuts
 */
export const SPEED_SHORTCUTS = {
  // Ultra-fast shortcuts
  'fast apply': 'batch_job_application with mode aggressive',
  'quick apply': 'fast_form_fill with use_templates true',
  'speed apply': 'execute_workflow generic_fast_apply without AI',

  // Platform-specific shortcuts
  'linkedin fast': 'execute_workflow linkedin_easy_apply_fast',
  'indeed fast': 'execute_workflow indeed_quick_apply_fast',
  'workday apply': 'execute_workflow workday_ats_smart',

  // Batch operations
  'fill all fields': 'fast_form_fill with timeout_seconds 30',
  'complete form': 'batch_job_application with auto_submit false',
  'submit application': 'batch_job_application with auto_submit true',

  // Development shortcuts
  'test workflow': 'batch_job_application with mode conservative',
  'debug apply': 'auto_fill_job_application with verbose logging',
};

/**
 * Initialize pre-built workflows in storage
 */
export async function initializePrebuiltWorkflows(): Promise<void> {
  try {
    const existing = await chrome.storage.local.get('jobhuntllm_workflows');
    const existingWorkflows = existing.jobhuntllm_workflows || [];

    // Only add workflows that don't already exist
    const newWorkflows = PREBUILT_WORKFLOWS.filter(
      prebuilt => !existingWorkflows.some((existing: WorkflowPattern) => existing.id === prebuilt.id),
    );

    if (newWorkflows.length > 0) {
      const updatedWorkflows = [...existingWorkflows, ...newWorkflows];
      await chrome.storage.local.set({ jobhuntllm_workflows: updatedWorkflows });
      console.log(`Initialized ${newWorkflows.length} pre-built workflows`);
    }
  } catch (error) {
    console.error('Failed to initialize pre-built workflows:', error);
  }
}

/**
 * Get workflow by shortcut command
 */
export function getWorkflowByShortcut(command: string): string | null {
  const normalizedCommand = command.toLowerCase().trim();

  for (const [shortcut, action] of Object.entries(SPEED_SHORTCUTS)) {
    if (normalizedCommand.includes(shortcut)) {
      return action;
    }
  }

  return null;
}

/**
 * Quick workflow execution based on detected platform
 */
export async function getOptimalWorkflow(url: string): Promise<WorkflowPattern | null> {
  try {
    const existing = await chrome.storage.local.get('jobhuntllm_workflows');
    const workflows = existing.jobhuntllm_workflows || PREBUILT_WORKFLOWS;

    // Detect platform from URL
    let platform = 'other';
    if (url.includes('linkedin.com')) platform = 'linkedin';
    else if (url.includes('indeed.com')) platform = 'indeed';
    else if (url.includes('workday')) platform = 'workday';
    else if (url.includes('greenhouse')) platform = 'greenhouse';

    // Find best workflow for platform
    const platformWorkflows = workflows.filter((w: WorkflowPattern) => w.platform === platform);
    if (platformWorkflows.length === 0) {
      return workflows.find((w: WorkflowPattern) => w.id === 'generic_fast_apply') || null;
    }

    // Return workflow with highest success rate
    return platformWorkflows.sort((a: WorkflowPattern, b: WorkflowPattern) => b.successRate - a.successRate)[0];
  } catch (error) {
    console.error('Failed to get optimal workflow:', error);
    return null;
  }
}

/**
 * Development mode workflow with detailed logging
 */
export const DEVELOPMENT_WORKFLOW: WorkflowPattern = {
  id: 'development_mode',
  name: '🔧 Development Mode (Detailed)',
  platform: 'other',
  applicationType: 'development',
  successRate: 1.0,
  averageTime: 180000, // 3 minutes with full logging
  createdAt: '2024-01-01T00:00:00.000Z',
  lastUsed: '2024-01-01T00:00:00.000Z',
  usageCount: 0,
  steps: [
    {
      action: 'detect_job_application_form',
      parameters: {
        save_pattern: true,
      },
      description: 'Analyze form structure for development',
      isAIRequired: true,
    },
    {
      action: 'auto_fill_job_application',
      parameters: {
        application_type: 'development',
      },
      description: 'Fill form with detailed logging',
      isAIRequired: false,
    },
    {
      action: 'save_workflow',
      parameters: {
        platform: 'detected',
        application_type: 'learned',
        workflow_name: 'Auto-generated from development',
      },
      description: 'Save learned pattern as new workflow',
      isAIRequired: false,
    },
  ],
};
